import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createFalVideoJob } from "@/lib/wovo-ai/fal-video";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isUuid } from "@/lib/wovo-ai/feed-utils";
import { getEnv } from "@/lib/env";
import { quoteShortVideo } from "@/lib/ai/provider-models";
import { checkAiRateLimit } from "@/lib/wovo-ai/rate-limit";
import { assertPortalAccountAccess, PortalHttpError, requirePortalContext } from "@/lib/portal/server";
import { signedMediaUrl } from "@/lib/wovo-ai/media-token";
import { ensureWorkspaceUsagePolicy } from "@/lib/wovo-ai/usage-policy";

type CreateVideoBody = {
  prompt?: string;
  durationSeconds?: number;
  remixMode?: "standard" | "animate_image" | "replace_dance";
  inputReferenceImage?: string;
  sourceOutputId?: string;
  preview?: boolean;
  accountId?: string;
};

type VideoJobRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  usage_request_id: string | null;
  prompt: string;
  status: string;
  provider: string;
  provider_job_id: string | null;
  result_url: string | null;
  result_payload?: Record<string, unknown> | null;
  error?: string | null;
  updated_at?: string;
  created_at: string;
};

type VideoRemixMode = "standard" | "animate_image" | "replace_dance";

function visibleVideoJob(requestUrl: string, row: VideoJobRow) {
  let mediaUrl: string | null = null;
  if (row.status === "completed") {
    try {
      mediaUrl = signedMediaUrl(requestUrl, { kind: "video", jobId: row.id, ownerUserId: row.user_id, lifetimeSeconds: 30 * 24 * 60 * 60 });
    } catch {
      mediaUrl = null;
    }
  }
  return { ...row, result_url: mediaUrl };
}

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const accountId = new URL(request.url).searchParams.get("accountId")?.trim() ?? "";
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Choose a valid workspace.");
    await assertPortalAccountAccess(context, accountId);
    const rows = await supabaseServiceRoleRequest<VideoJobRow[]>(
      `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,prompt,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&account_id=eq.${encodeURIComponent(accountId)}&order=created_at.desc&limit=40`,
    ) ?? [];
    return NextResponse.json({ jobs: rows.map((row) => visibleVideoJob(request.url, row)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof PortalHttpError ? error.status : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load video projects." }, { status });
  }
}

export async function POST(request: Request) {
  let pendingJobId: string | null = null;
  let pendingActorUserId: string | null = null;
  let pendingPaidReservation = false;
  let pendingWasPreview = false;
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const user = context.user;
    pendingActorUserId = user.id;
    const body = (await request.json().catch(() => ({}))) as CreateVideoBody;
    const isWorkspacePreview = body.preview === true;
    pendingWasPreview = isWorkspacePreview;
    const accountId = body.accountId?.trim() ?? "";
    if (!isUuid(accountId)) {
      return NextResponse.json({ error: "Select a valid workspace before creating video." }, { status: 400 });
    }
    await assertPortalAccountAccess(context, accountId);

    const rateLimit = checkAiRateLimit(user.id, "video");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "You're sending requests too quickly. Please wait a few minutes and try again." }, { status: 429 });
    }

    if (getEnv("WOVO_VIDEO_GENERATION_ENABLED") !== "true") {
      return NextResponse.json(
        { error: "Video generation is not enabled because WOVO has not completed the current provider, metering, private-storage, and refund-path verification." },
        { status: 503 },
      );
    }

    const billingSource = isWorkspacePreview ? "workspace_preview" : "workspace_credits";
    const ownerExempt = !isWorkspacePreview && context.mode === "staff" && context.staffRole === "owner";
    if (!isWorkspacePreview && !ownerExempt) await ensureWorkspaceUsagePolicy(context, accountId);
    if (isWorkspacePreview) {
      const accounts = await supabaseServiceRoleRequest<Array<{ id: string; owner_user_id: string }>>(
        `/rest/v1/wovo_portal_accounts?select=id,owner_user_id&id=eq.${encodeURIComponent(accountId)}&owner_user_id=eq.${encodeURIComponent(user.id)}&archived_at=is.null&limit=1`,
      );
      const account = accounts?.[0];
      if (!account) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
      const priorJobs = await supabaseServiceRoleRequest<Array<{ id: string; status: string; result_payload: Record<string, unknown> | null }>>(
        `/rest/v1/video_jobs?select=id,status,result_payload&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=100`,
      );
      const priorPreview = (priorJobs ?? []).find(
        (job) => job.status !== "failed" && asString(asRecord(job.result_payload).previewAccountId) === accountId,
      );
      if (priorPreview) {
        return NextResponse.json(
          { error: "This workspace already used its complimentary video preview.", existingJobId: priorPreview.id },
          { status: 409 },
        );
      }
    }
    const prompt = body.prompt?.trim() ?? "";

    if (prompt.length < 3 || prompt.length > 6000) {
      return NextResponse.json({ error: "Describe the video in 3 to 6,000 characters." }, { status: 400 });
    }

    const remixModeRaw = (body.remixMode ?? "standard").trim().toLowerCase();
    if (!["standard", "animate_image", "replace_dance"].includes(remixModeRaw)) {
      return NextResponse.json({ error: "Invalid remix mode." }, { status: 400 });
    }

    const remixMode = remixModeRaw as VideoRemixMode;
    const sourceOutputId = body.sourceOutputId?.trim() ?? "";
    const inputReferenceImage = body.inputReferenceImage?.trim() ?? "";

    if (remixMode === "animate_image" && !inputReferenceImage) {
      return NextResponse.json({ error: "Upload an image to animate for this remix mode." }, { status: 400 });
    }

    if (remixMode === "replace_dance") {
      return NextResponse.json({ error: "Dance replacement is temporarily unavailable while WOVO verifies a consent-safe provider." }, { status: 503 });
    }

    const jobId = randomUUID();
    pendingJobId = jobId;
    const quote = quoteShortVideo(remixMode === "animate_image");
    const initialPayload = {
      model: quote.models[0]?.modelId ?? null,
      modelPricingVersion: quote.models[0]?.pricingVersion ?? null,
      modelRegistryVersion: quote.registryVersion,
      estimatedProviderCostMicros: quote.estimatedProviderCostMicros,
      quotedCredits: quote.customerCredits,
      remixMode,
      sourceOutputId: sourceOutputId || null,
      sourceVideoJobId: null,
      hasInputReferenceImage: remixMode === "animate_image" ? Boolean(inputReferenceImage) : false,
      workspacePreview: isWorkspacePreview,
      previewAccountId: isWorkspacePreview ? accountId : null,
      previewWatermarkRequired: isWorkspacePreview,
      ownerExempt,
    };
    let createdJob: VideoJobRow | null = null;
    if (isWorkspacePreview || ownerExempt) {
      const rows = await supabaseServiceRoleRequest<VideoJobRow[]>(
        "/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,prompt,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            id: jobId,
            user_id: user.id,
            account_id: accountId,
            provider: "fal",
            provider_job_id: null,
            prompt,
            status: "queued",
            result_url: null,
            result_payload: initialPayload,
          }),
        },
      );
      createdJob = rows?.[0] ?? null;
    } else {
      const reserved = await supabaseServiceRoleRequest<VideoJobRow | VideoJobRow[]>(
        "/rest/v1/rpc/wovo_video_create_reserved_job",
        {
          method: "POST",
          body: JSON.stringify({
            p_job_id: jobId,
            p_account_id: accountId,
            p_actor_user_id: user.id,
            p_prompt: prompt,
            p_estimated_units: quote.customerCredits,
            p_estimated_provider_cost_micros: quote.estimatedProviderCostMicros,
            p_payload: initialPayload,
          }),
        },
      );
      createdJob = Array.isArray(reserved) ? reserved[0] ?? null : reserved;
      pendingPaidReservation = Boolean(createdJob?.usage_request_id);
    }

    if (!createdJob) throw new Error("VIDEO_LEDGER_CREATE_FAILED");

    const falJob = await createFalVideoJob({
      prompt,
      durationSeconds: body.durationSeconds,
      inputReferenceImageUrl: remixMode === "animate_image" ? inputReferenceImage : undefined,
    });

    const updatedRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
      `/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,account_id,usage_request_id,status,provider,provider_job_id,result_url,created_at`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          provider_job_id: falJob.providerJobId,
          status: falJob.status,
          updated_at: new Date().toISOString(),
          result_payload: {
            model: falJob.model,
            modelPricingVersion: falJob.pricingVersion,
            modelRegistryVersion: falJob.registryVersion,
            estimatedProviderCostMicros: falJob.estimatedProviderCostMicros,
            quotedCredits: falJob.quotedCredits,
            usageRequestId: createdJob.usage_request_id,
            durationSeconds: falJob.seconds,
            remixMode,
            sourceOutputId: sourceOutputId || null,
            sourceVideoJobId: null,
            hasInputReferenceImage: remixMode === "animate_image" ? Boolean(inputReferenceImage) : false,
            workspacePreview: isWorkspacePreview,
            previewAccountId: isWorkspacePreview ? body.accountId?.trim() : null,
            previewWatermarkRequired: isWorkspacePreview,
          },
        }),
      },
    );

    const created = updatedRows?.[0];
    if (!created) throw new Error("VIDEO_LEDGER_UPDATE_FAILED");
    pendingJobId = null;
    return NextResponse.json({
      job: created,
      billing_source: billingSource,
      reserved_credits: isWorkspacePreview || ownerExempt ? 0 : quote.customerCredits,
      owner_exempt: ownerExempt,
      warning: null,
    });
  } catch (error) {
    if (pendingJobId && pendingActorUserId) {
      const failureCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "VIDEO_PROVIDER_SUBMISSION_FAILED";
      if (pendingPaidReservation) {
        await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_video_fail_job", {
          method: "POST",
          body: JSON.stringify({
            p_job_id: pendingJobId,
            p_actor_user_id: pendingActorUserId,
            p_error_code: failureCode,
          }),
        }).catch(() => undefined);
      } else {
        await supabaseServiceRoleRequest(
          `/rest/v1/video_jobs?id=eq.${encodeURIComponent(pendingJobId)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              status: "failed",
              error: failureCode,
              updated_at: new Date().toISOString(),
            }),
          },
        ).catch(() => undefined);
      }
    }
    const message = error instanceof Error ? error.message : "";
    if (error instanceof PortalHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("wovo_video_create_failed", {
      code: /^[A-Z0-9_]+$/.test(message) ? message : "VIDEO_CREATE_FAILED",
      ledgerCreated: Boolean(pendingJobId),
    });
    if (message.includes("video_jobs_workspace_preview_unique_idx")) {
      return NextResponse.json({ error: "This workspace already used its complimentary video preview." }, { status: 409 });
    }
    if (message.includes("Insufficient AI credits")) {
      return NextResponse.json({ error: "This workspace does not have enough credits for the video quote." }, { status: 402 });
    }
    if (message.includes("AI rate limit reached")) {
      return NextResponse.json({ error: "You're sending requests too quickly. Please wait a few minutes and try again." }, { status: 429 });
    }
    if (message.includes("WOVO AI is not enabled") || message.includes("AI spend cap reached") || message.includes("AI allowance reached")) {
      return NextResponse.json({ error: "Video creation is not enabled for this workspace right now." }, { status: 503 });
    }
    if (message.includes("not authorized for this account")) {
      return NextResponse.json({ error: "You do not have access to that workspace." }, { status: 403 });
    }
    if (message.includes("Video workspace is unavailable")) {
      return NextResponse.json({ error: "That workspace is unavailable." }, { status: 404 });
    }
    const safeMessage = message.startsWith("FAL_") || message.startsWith("VIDEO_")
      ? "The video provider is temporarily unavailable. Please try again shortly."
      : `Unable to create the ${pendingWasPreview ? "preview" : "video"} right now. Please try again.`;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
