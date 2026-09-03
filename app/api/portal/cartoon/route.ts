import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";
import { createManualCartoonSlot, hasCartoonEntitlement, processCartoonProduction, type CartoonEpisodeRow, type CartoonSeriesRow } from "@/lib/cartoon/server";
import { cartoonProviderStatus, getValidatedCartoonSeriesPrice } from "@/lib/portal/cartoon-series";
import { assertPortalAccountAccess, isUuid, optionalString, PortalHttpError, requiredString, requirePortalContext, type PortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { customerSafeMessage, internalErrorCode } from "@/lib/errors/customer-safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(error: unknown) {
  if (error instanceof PortalHttpError) return NextResponse.json({ error: customerSafeMessage(error, "Cartoon request failed.") }, { status: error.status });
  const message = customerSafeMessage(error, "Cartoon request failed.");
  if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.error("Cartoon Episodes request failed", { name: error instanceof Error ? error.name : "UnknownError", message: message.slice(0, 160) });
  return NextResponse.json({ error: "WOVO could not complete that request. Nothing was published or charged." }, { status: 500 });
}

function siteUrl(request: Request) {
  return (getEnv("NEXT_PUBLIC_SITE_URL") || getEnv("NEXT_PUBLIC_APP_URL") || new URL(request.url).origin).replace(/\/$/, "");
}

async function requireBaseAccess(context: PortalContext, accountId: string) {
  await assertPortalAccountAccess(context, accountId);
  if (context.mode === "staff") return;
  const now = new Date().toISOString();
  const [paid, grants] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ status: string }>>(`/rest/v1/wovo_portal_subscriptions?select=status&account_id=eq.${encodeURIComponent(accountId)}&status=in.(active,trialing)&limit=1`).catch(() => []),
    supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_portal_access_grants?select=id&account_id=eq.${encodeURIComponent(accountId)}&revoked_at=is.null&starts_at=lte.${encodeURIComponent(now)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`).catch(() => []),
  ]);
  if (!paid?.[0] && !grants?.[0]) throw new PortalHttpError(402, "An active WOVO base subscription is required before activating Cartoon Episodes.");
}

async function loadSeries(accountId: string) {
  const rows = await supabaseServiceRoleRequest<CartoonSeriesRow[]>(`/rest/v1/wovo_cartoon_series?select=*&account_id=eq.${encodeURIComponent(accountId)}&limit=1`).catch(() => []);
  return rows?.[0] ?? null;
}

async function loadSnapshot(context: PortalContext, accountId: string) {
  await requireBaseAccess(context, accountId);
  const [series, episodes, entitlement, price] = await Promise.all([
    loadSeries(accountId),
    supabaseServiceRoleRequest<CartoonEpisodeRow[]>(`/rest/v1/wovo_cartoon_episode_jobs?select=*&account_id=eq.${encodeURIComponent(accountId)}&status=neq.archived&order=episode_number.desc&limit=40`).catch(() => []),
    supabaseServiceRoleRequest<Array<Record<string, unknown>>>(`/rest/v1/wovo_portal_entitlements?select=entitlement_key,status,current_period_end,cancel_at_period_end,provisioning_status&account_id=eq.${encodeURIComponent(accountId)}&entitlement_key=eq.cartoon_series&limit=1`).catch(() => []),
    getValidatedCartoonSeriesPrice(),
  ]);
  const staffTestAccess = context.mode === "staff" && context.staffRole === "owner";
  return {
    series,
    episodes: episodes ?? [],
    entitlement: entitlement?.[0] ?? null,
    hasAccess: staffTestAccess || await hasCartoonEntitlement(accountId),
    staffTestAccess,
    provider: cartoonProviderStatus(),
    checkout: price ? { enabled: true, amountCents: price.amountCents, label: price.label, renewalLabel: price.renewalLabel } : { enabled: false, amountCents: 3999, label: "$39.99/month", renewalLabel: "$39.99 every month" },
    product: {
      episodesPerWeek: 3,
      secondsPerEpisode: 8,
      format: "Vertical short cartoon clip",
      publishingIncluded: false,
      reviewRequired: true,
    },
  };
}

function adminStorage() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase Storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const accountId = new URL(request.url).searchParams.get("accountId");
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Invalid workspace.");
    return NextResponse.json(await loadSnapshot(context, accountId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const accountId = body.accountId;
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Invalid workspace.");
    await requireBaseAccess(context, accountId);

    if (body.action === "start_checkout") {
      if (await hasCartoonEntitlement(accountId)) throw new PortalHttpError(409, "This workspace already has Cartoon Episodes access.");
      const price = await getValidatedCartoonSeriesPrice();
      if (!price) throw new PortalHttpError(503, "Cartoon Episodes checkout is not available until the verified Stripe price and production provider test are complete.");
      const customerId = await ensureStripeCustomerForUser(context.user.id, context.user.email);
      const session = await createCheckoutSession({
        customerId,
        priceId: price.priceId,
        userId: context.user.id,
        successUrl: `${siteUrl(request)}/portal?cartoon=success`,
        cancelUrl: `${siteUrl(request)}/portal?cartoon=canceled`,
        mode: "subscription",
        metadata: { product: "wovo_portal", portalAccountId: accountId, portalPurchaseType: "cartoon_series", portalEntitlementKey: "cartoon_series", portalBillingFrequency: "monthly" },
      });
      return NextResponse.json({ url: session.url });
    }

    if (body.action === "save_series") {
      if (body.sourceRightsConfirmed !== true) throw new PortalHttpError(400, "Confirm that you own or have permission to use every supplied character and reference asset.");
      const identifiable = body.identifiablePersonIncluded === true;
      if (identifiable && body.likenessConsentConfirmed !== true) throw new PortalHttpError(400, "A recognizable person requires explicit likeness consent.");
      const hasAccess = (context.mode === "staff" && context.staffRole === "owner") || await hasCartoonEntitlement(accountId);
      const providers = cartoonProviderStatus();
      const requestedAutomatic = body.autoGenerateEnabled === true;
      if (requestedAutomatic && !hasAccess) throw new PortalHttpError(402, "Activate Cartoon Episodes before turning on the three-times-weekly production schedule.");
      if (requestedAutomatic && !providers.video) throw new PortalHttpError(409, "Automatic video production is unavailable until the production video provider passes its live test.");
      const existing = await loadSeries(accountId);
      const rows = await supabaseServiceRoleRequest<CartoonSeriesRow[]>("/rest/v1/wovo_cartoon_series?on_conflict=account_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          account_id: accountId,
          created_by: existing?.created_by ?? context.user.id,
          title: requiredString(body.title, "Series title", 120),
          character_name: requiredString(body.characterName, "Character name", 100),
          character_description: requiredString(body.characterDescription, "Character description", 3000),
          audience: requiredString(body.audience, "Audience", 1000),
          series_goal: requiredString(body.seriesGoal, "Series goal", 1500),
          style_direction: requiredString(body.styleDirection, "Style direction", 1500),
          do_not_include: optionalString(body.doNotInclude, 1500) ?? "",
          timezone: requiredString(body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, "Timezone", 80),
          episode_days: [1, 3, 5],
          local_generation_hour: 8,
          source_rights_confirmed: true,
          identifiable_person_included: identifiable,
          likeness_consent_confirmed: body.likenessConsentConfirmed === true,
          voice_consent_confirmed: body.voiceConsentConfirmed === true,
          auto_generate_enabled: requestedAutomatic,
          kill_switch: body.paused === true,
          status: body.paused === true ? "paused" : hasAccess ? "active" : "billing_required",
          updated_at: new Date().toISOString(),
        }),
      });
      return NextResponse.json({ series: rows?.[0] });
    }

    const series = await loadSeries(accountId);
    if (!series) throw new PortalHttpError(409, "Save the character and series setup first.");

    if (body.action === "generate_now") {
      if (!(context.mode === "staff" && context.staffRole === "owner") && !(await hasCartoonEntitlement(accountId))) throw new PortalHttpError(402, "Cartoon Episodes billing is not active.");
      if (!cartoonProviderStatus().video) throw new PortalHttpError(503, "The production video provider is not enabled.");
      const recent = await supabaseServiceRoleRequest<Array<{ id: string }>>(`/rest/v1/wovo_cartoon_episode_jobs?select=id&series_id=eq.${encodeURIComponent(series.id)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 7 * 86_400_000).toISOString())}&status=not.in.(failed,blocked,archived)&limit=4`).catch(() => []);
      if ((recent?.length ?? 0) >= 3) throw new PortalHttpError(429, "This series has reached its three-episode weekly production allowance.");
      const episode = await createManualCartoonSlot(series);
      if (!episode) throw new PortalHttpError(409, "Today’s episode is already queued.");
      const result = await processCartoonProduction({ accountId, limit: 1 });
      return NextResponse.json({ episode, processing: result }, { status: 202 });
    }

    if (body.action === "approve_episode") {
      const episodeId = body.episodeId;
      if (!isUuid(episodeId)) throw new PortalHttpError(400, "Invalid episode.");
      const rows = await supabaseServiceRoleRequest<CartoonEpisodeRow[]>(`/rest/v1/wovo_cartoon_episode_jobs?id=eq.${encodeURIComponent(episodeId)}&account_id=eq.${encodeURIComponent(accountId)}&status=in.(needs_approval,draft_ready)`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "approved", approved_at: new Date().toISOString(), approved_by: context.user.id, updated_at: new Date().toISOString() }),
      });
      if (!rows?.[0]) throw new PortalHttpError(409, "This episode is not waiting for approval.");
      return NextResponse.json({ episode: rows[0], publishing: "not_connected" });
    }

    if (body.action === "open_episode") {
      const episodeId = body.episodeId;
      if (!isUuid(episodeId)) throw new PortalHttpError(400, "Invalid episode.");
      const rows = await supabaseServiceRoleRequest<CartoonEpisodeRow[]>(`/rest/v1/wovo_cartoon_episode_jobs?select=*&id=eq.${encodeURIComponent(episodeId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`).catch(() => []);
      const episode = rows?.[0];
      if (!episode?.storage_bucket || !episode.storage_path) throw new PortalHttpError(409, "The episode video is not ready yet.");
      const { data, error } = await adminStorage().storage.from(episode.storage_bucket).createSignedUrl(episode.storage_path, 600, { download: `${series.character_name || "wovo"}-episode-${episode.episode_number}.mp4` });
      if (error || !data?.signedUrl) throw new Error("Unable to create private episode link.");
      return NextResponse.json({ url: data.signedUrl, expiresInSeconds: 600 });
    }

    throw new PortalHttpError(400, "Unknown Cartoon Episodes action.");
  } catch (error) { return errorResponse(error); }
}
