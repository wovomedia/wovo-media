import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createFalMusicJob } from "@/lib/wovo-ai/fal-music";
import { quoteMusicTrack, resolveAiModel, type MusicQuality } from "@/lib/ai/provider-models";
import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, PortalHttpError, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/wovo-ai/rate-limit";
import { isUuid } from "@/lib/wovo-ai/feed-utils";
import { signedMediaUrl } from "@/lib/wovo-ai/media-token";
import { ensureWorkspaceUsagePolicy } from "@/lib/wovo-ai/usage-policy";
import { customerSafeMessage } from "@/lib/errors/customer-safe";

export const runtime = "nodejs";

type MusicJobRow = {
  id: string;
  user_id: string;
  account_id: string;
  usage_request_id: string | null;
  provider: string;
  provider_job_id: string | null;
  model: string;
  quality: MusicQuality;
  prompt: string;
  duration_seconds: number;
  status: string;
  result_url: string | null;
  storage_path: string | null;
  result_payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function visibleJob(requestUrl: string, row: MusicJobRow) {
  let mediaUrl: string | null = null;
  if (row.status === "completed" && row.storage_path) {
    try {
      mediaUrl = signedMediaUrl(requestUrl, { kind: "music", jobId: row.id, ownerUserId: row.user_id, lifetimeSeconds: 30 * 24 * 60 * 60 });
    } catch {
      mediaUrl = null;
    }
  }
  return {
    id: row.id,
    accountId: row.account_id,
    model: row.model,
    quality: row.quality,
    prompt: row.prompt,
    durationSeconds: row.duration_seconds,
    status: row.status,
    mediaUrl,
    error: row.error ? "The music provider could not complete this track." : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const accountId = new URL(request.url).searchParams.get("accountId")?.trim() ?? "";
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Choose a valid workspace.");
    await assertPortalAccountAccess(context, accountId);
    const rows = await supabaseServiceRoleRequest<MusicJobRow[]>(
      `/rest/v1/wovo_music_jobs?select=*&account_id=eq.${encodeURIComponent(accountId)}&order=created_at.desc&limit=40`,
    ) ?? [];
    return NextResponse.json({ jobs: rows.map((row) => visibleJob(request.url, row)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof PortalHttpError ? error.status : 401;
    return NextResponse.json({ error: customerSafeMessage(error, "Unable to load music projects.") }, { status });
  }
}

export async function POST(request: Request) {
  let pendingJobId: string | null = null;
  let pendingActorUserId: string | null = null;
  let pendingPaidReservation = false;
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    pendingActorUserId = context.user.id;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Choose a valid workspace.");
    await assertPortalAccountAccess(context, accountId);
    if (getEnv("WOVO_MUSIC_GENERATION_ENABLED") !== "true") {
      throw new PortalHttpError(503, "Music generation is not enabled until provider billing and private storage are verified.");
    }
    const rateLimit = checkAiRateLimit(context.user.id, "music");
    if (!rateLimit.allowed) throw new PortalHttpError(429, "You're sending requests too quickly. Please wait and try again.");
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 10 || prompt.length > 3000) throw new PortalHttpError(400, "Describe the track in 10 to 3,000 characters.");
    const quality: MusicQuality = body.quality === "premium" ? "premium" : "economy";
    const requestedDuration = Number(body.durationSeconds ?? 60);
    const durationSeconds = [30, 60, 120, 180].includes(requestedDuration) ? requestedDuration : 60;
    const quote = quoteMusicTrack(quality, durationSeconds);
    const resolved = resolveAiModel(quality === "premium" ? "music.premium" : "music.economy");
    const ownerExempt = context.mode === "staff" && context.staffRole === "owner";
    if (!ownerExempt) await ensureWorkspaceUsagePolicy(context, accountId);
    const jobId = randomUUID();
    pendingJobId = jobId;
    const initialPayload = {
      modelRegistryVersion: quote.registryVersion,
      modelPricingVersion: resolved.pricingVersion,
      estimatedProviderCostMicros: quote.estimatedProviderCostMicros,
      quotedCredits: quote.customerCredits,
      ownerExempt,
    };
    let created: MusicJobRow | null = null;
    if (ownerExempt) {
      const rows = await supabaseServiceRoleRequest<MusicJobRow[]>(
        "/rest/v1/wovo_music_jobs?select=*",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            id: jobId,
            user_id: context.user.id,
            account_id: accountId,
            usage_request_id: null,
            provider: "fal",
            model: resolved.modelId,
            quality,
            prompt,
            duration_seconds: durationSeconds,
            status: "queued",
            result_payload: initialPayload,
          }),
        },
      );
      created = rows?.[0] ?? null;
    } else {
      const reserved = await supabaseServiceRoleRequest<MusicJobRow | MusicJobRow[]>(
        "/rest/v1/rpc/wovo_music_create_reserved_job",
        {
          method: "POST",
          body: JSON.stringify({
            p_job_id: jobId,
            p_account_id: accountId,
            p_actor_user_id: context.user.id,
            p_prompt: prompt,
            p_model: resolved.modelId,
            p_quality: quality,
            p_duration_seconds: durationSeconds,
            p_estimated_units: quote.customerCredits,
            p_estimated_provider_cost_micros: quote.estimatedProviderCostMicros,
            p_payload: initialPayload,
          }),
        },
      );
      created = Array.isArray(reserved) ? reserved[0] ?? null : reserved;
      pendingPaidReservation = Boolean(created?.usage_request_id);
    }
    if (!created) throw new Error("MUSIC_LEDGER_CREATE_FAILED");

    const provider = await createFalMusicJob({ prompt, durationSeconds, quality });
    const updated = await supabaseServiceRoleRequest<MusicJobRow[]>(
      `/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(context.user.id)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          provider_job_id: provider.providerJobId,
          status: provider.status,
          result_payload: { ...initialPayload, providerSubmitted: true },
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!updated?.[0]) throw new Error("MUSIC_LEDGER_UPDATE_FAILED");
    pendingJobId = null;
    return NextResponse.json({
      job: visibleJob(request.url, updated[0]),
      reservedCredits: ownerExempt ? 0 : quote.customerCredits,
      ownerExempt,
    });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "MUSIC_PROVIDER_SUBMISSION_FAILED";
    if (pendingJobId && pendingActorUserId) {
      if (pendingPaidReservation) {
        await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_music_fail_job", {
          method: "POST",
          body: JSON.stringify({ p_job_id: pendingJobId, p_actor_user_id: pendingActorUserId, p_error_code: code }),
        }).catch(() => null);
      } else {
        await supabaseServiceRoleRequest(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(pendingJobId)}&user_id=eq.${encodeURIComponent(pendingActorUserId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", error: code, updated_at: new Date().toISOString() }),
        }).catch(() => null);
      }
    }
    const status = error instanceof PortalHttpError ? error.status
      : error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session")) ? 401
      : error instanceof Error && error.message.includes("Insufficient AI credits") ? 402
        : 500;
    const message = error instanceof PortalHttpError
      ? customerSafeMessage(error, "Unable to start that music track.")
      : status === 401
        ? "Unauthorized"
      : status === 402
        ? "This workspace does not have enough credits for that music model."
        : "The music provider is temporarily unavailable. No credits were kept for a failed submission.";
    if (status !== 401) console.error("wovo_music_create_failed", { code, ledgerCreated: Boolean(pendingJobId) });
    return NextResponse.json({ error: message }, { status });
  }
}
