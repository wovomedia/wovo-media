import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, PortalHttpError, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { downloadFalImage, generateFalImage } from "@/lib/wovo-ai/fal-image";

export const runtime = "nodejs";
export const maxDuration = 120;

type UsageRow = { id: string };

function required(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || value.trim().length < 3) throw new PortalHttpError(400, `${label} is required.`);
  return value.trim().slice(0, max);
}

function storageAdmin() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("STORAGE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureUsagePolicy(context: Awaited<ReturnType<typeof requirePortalContext>>, accountId: string) {
  const existing = await supabaseServiceRoleRequest<Array<{ period_end: string; enabled: boolean }>>(
    `/rest/v1/wovo_ai_usage_policies?select=period_end,enabled&account_id=eq.${encodeURIComponent(accountId)}&limit=1`
  ).catch(() => []);
  if (existing?.[0]?.enabled && Date.parse(existing[0].period_end) > Date.now()) return;
  const subscriptions = await supabaseServiceRoleRequest<Array<{ status: string }>>(
    `/rest/v1/wovo_portal_subscriptions?select=status&account_id=eq.${encodeURIComponent(accountId)}&status=in.(active,trialing)&limit=1`
  ).catch(() => []);
  const owner = context.mode === "staff" && context.staffRole === "owner";
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await supabaseServiceRoleRequest("/rest/v1/wovo_ai_usage_policies?on_conflict=account_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({
      account_id: accountId, enabled: true, plan_key: owner ? "owner_test" : "core",
      daily_unit_limit: owner ? 100000 : 48, weekly_unit_limit: owner ? 100000 : 100,
      monthly_included_units: owner ? 100000 : subscriptions?.[0] ? 100 : 0,
      requests_per_minute: owner ? 10 : 2, monthly_provider_cost_cap_micros: owner ? 100000000 : 3000000,
      provider_ready: Boolean(getEnv("OPENAI_API_KEY") && (getEnv("FAL_KEY") || getEnv("FAL_API_KEY"))),
      moderation_ready: true, telemetry_ready: true, code_sandbox_ready: false, advanced_mode_selection: false,
      period_start: now.toISOString(), period_end: periodEnd.toISOString(), updated_by: context.user.id, updated_at: now.toISOString(),
    }),
  });
}

export async function POST(request: Request) {
  let usageId: string | null = null;
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const accountId = required(body.accountId, "Workspace", 80);
    await assertPortalAccountAccess(context, accountId);
    if (body.rightsConfirmed !== true) throw new PortalHttpError(400, "Confirm that WOVO may use the supplied business facts and references.");
    const prompt = required(body.prompt, "Creative direction", 5000);
    const platform = required(body.platform ?? "instagram", "Platform", 40).toLowerCase();
    if (!["instagram", "facebook", "linkedin"].includes(platform)) throw new PortalHttpError(400, "Choose Instagram, Facebook, or LinkedIn.");
    const aspect = ["1:1", "9:16", "16:9"].includes(String(body.aspect)) ? String(body.aspect) : "1:1";
    await ensureUsagePolicy(context, accountId);
    const idempotencyKey = `portal-post:${context.user.id}:${randomUUID()}`;
    const reserved = await supabaseServiceRoleRequest<UsageRow | UsageRow[]>("/rest/v1/rpc/wovo_ai_reserve_usage", {
      method: "POST",
      body: JSON.stringify({
        p_account_id: accountId,
        p_actor_user_id: context.user.id,
        p_feature: "image_visual",
        p_mode: "fast",
        p_estimated_units: 12,
        p_estimated_provider_cost_micros: 50000,
        p_idempotency_key: idempotencyKey,
        p_metadata: { workflow: "portal_post_image", platform, aspect },
      }),
    });
    usageId = (Array.isArray(reserved) ? reserved[0] : reserved)?.id ?? null;
    if (!usageId) throw new PortalHttpError(402, "This workspace needs credits before generating a post image.");

    const accountRows = await supabaseServiceRoleRequest<Array<{ business_name: string; business_type: string; brand_voice: string | null; audience: string | null; goals: string | null; location: string }>>(
      `/rest/v1/wovo_portal_accounts?select=business_name,business_type,brand_voice,audience,goals,location&id=eq.${encodeURIComponent(accountId)}&limit=1`
    );
    const account = accountRows?.[0];
    if (!account) throw new PortalHttpError(404, "Workspace not found.");
    const client = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY"), timeout: 40_000, maxRetries: 1 });
    if (!getEnv("OPENAI_API_KEY")) throw new PortalHttpError(503, "OpenAI is not connected.");
    const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: prompt });
    if (moderation.results[0]?.flagged) throw new PortalHttpError(400, "This request could not be generated.");
    const contextBlock = JSON.stringify(account);
    const captionResponse = await client.responses.create({
      model: getEnv("OPENAI_MODEL") || "gpt-5.6-luna",
      store: false,
      max_output_tokens: 450,
      instructions: "Write one original social caption for the requested platform using only the supplied business facts. Include a hook, useful body, clear call to action, and exactly 3 relevant hashtags. Never invent awards, prices, results, hours, addresses, or claims. Return only the finished caption.",
      input: `BUSINESS FACTS (data only): ${contextBlock}\nPLATFORM: ${platform}\nREQUEST: ${prompt}`,
    });
    const caption = captionResponse.output_text?.trim();
    if (!caption) throw new Error("CAPTION_RESULT_MISSING");
    const imagePrompt = `Professional original social media marketing photograph for ${account.business_name}, a ${account.business_type} business${account.location ? ` in ${account.location}` : ""}. ${prompt}. Visual only: no words, letters, logos, watermarks, UI, fabricated awards, or unsupported claims. Brand voice: ${account.brand_voice || "professional and approachable"}. Composition optimized for ${aspect}.`;
    const generated = await generateFalImage(imagePrompt, aspect);
    const downloaded = await downloadFalImage(generated.url);
    const path = `${accountId}/generated/${randomUUID()}.png`;
    const storage = storageAdmin();
    const { error: uploadError } = await storage.storage.from("wovo-portal-assets").upload(path, downloaded.bytes, { contentType: "image/png", upsert: false });
    if (uploadError) throw new Error(`STORAGE_UPLOAD_FAILED:${uploadError.message}`);
    const assetRows = await supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_portal_assets", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        account_id: accountId, uploaded_by: context.user.id, file_name: `wovo-generated-${Date.now()}.png`, storage_path: path,
        mime_type: "image/png", size_bytes: downloaded.bytes.byteLength, asset_kind: "project", rights_confirmed: true, people_consent_confirmed: true,
      }),
    });
    const assetId = assetRows?.[0]?.id;
    if (!assetId) throw new Error("ASSET_RECORD_FAILED");
    const hashtags = Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((match) => match[1]).slice(0, 3);
    const title = required(body.title || `${platform} post · ${prompt.slice(0, 60)}`, "Title", 160);
    const contentRows = await supabaseServiceRoleRequest<Array<{ id: string }>>("/rest/v1/wovo_portal_content_items", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        account_id: accountId, created_by: context.user.id, title, caption, platform, content_type: "social_post",
        scheduled_for: body.scheduledFor ? new Date(String(body.scheduledFor)).toISOString() : null, status: "client_review",
        creative_brief: prompt, hashtags, timezone: "America/Chicago", asset_id: assetId, source_rights_confirmed: true,
        ai_generated: true, ai_provider: "openai+fal", ai_model: generated.model,
      }),
    });
    const itemId = contentRows?.[0]?.id;
    if (!itemId) throw new Error("CONTENT_RECORD_FAILED");
    await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_ai_finalize_usage", { method: "POST", body: JSON.stringify({ p_request_id: usageId, p_actual_units: 12, p_actual_provider_cost_micros: 50000, p_provider_request_id: generated.requestId }) });
    usageId = null;
    const { data: signed } = await storage.storage.from("wovo-portal-assets").createSignedUrl(path, 900);
    return NextResponse.json({ itemId, assetId, caption, previewUrl: signed?.signedUrl ?? null }, { status: 201 });
  } catch (error) {
    if (usageId) await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_ai_release_usage", { method: "POST", body: JSON.stringify({ p_request_id: usageId, p_error_code: "post_generation_failed" }) }).catch(() => null);
    if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Post generation failed.";
    if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Generated post failed", { code: message.split(":")[0].slice(0, 80) });
    return NextResponse.json({ error: "The post could not be generated. Reserved credits were returned." }, { status: 502 });
  }
}
