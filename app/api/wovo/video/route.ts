import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { createFalVideoJob } from "@/lib/wovo-ai/fal-video";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isUuid } from "@/lib/wovo-ai/feed-utils";
import { resolveUserEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";
import { getEnv } from "@/lib/env";

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
  status: string;
  provider: string;
  provider_job_id: string | null;
  result_url: string | null;
  created_at: string;
};

type VideoRemixMode = "standard" | "animate_image" | "replace_dance";

export async function POST(request: Request) {
  let pendingJobId: string | null = null;
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json().catch(() => ({}))) as CreateVideoBody;
    const isWorkspacePreview = body.preview === true;
    const subscription = await getSubscriptionStatus(user.id, resolveUserEmail(user));
    const effectivePlan = (subscription.effective_plan ?? subscription.plan ?? "none").toString().toLowerCase();
    const hasProFeatureAccess =
      subscription.admin_access === true ||
      subscription.user_role === "admin" ||
      effectivePlan === "pro" ||
      effectivePlan === "business";

    if (!hasProFeatureAccess && !isWorkspacePreview) {
      return NextResponse.json(
        { error: "AI Video Ad Studio and Dance Remix are Pro features. Upgrade to Pro to unlock video generation." },
        { status: 402 },
      );
    }

    if (getEnv("WOVO_VIDEO_GENERATION_ENABLED") !== "true") {
      return NextResponse.json(
        { error: "Video generation is not enabled because WOVO has not completed the current provider, metering, private-storage, and refund-path verification." },
        { status: 503 },
      );
    }

    let billingSource = "workspace_preview";
    let remainingTrialUses = 0;
    if (isWorkspacePreview) {
      const accountId = body.accountId?.trim() ?? "";
      if (!isUuid(accountId)) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
      const accounts = await supabaseServiceRoleRequest<Array<{ id: string; owner_user_id: string }>>(
        `/rest/v1/wovo_portal_accounts?select=id,owner_user_id&id=eq.${encodeURIComponent(accountId)}&owner_user_id=eq.${encodeURIComponent(user.id)}&archived_at=is.null&limit=1`,
      );
      const account = accounts?.[0];
      if (!account) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
      const priorJobs = await supabaseServiceRoleRequest<Array<{ id: string; status: string; result_payload: Record<string, unknown> | null }>>(
        `/rest/v1/video_jobs?select=id,status,result_payload&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=100`,
      );
      const priorPreview = (priorJobs ?? []).find((job) => asString(asRecord(job.result_payload).previewAccountId) === accountId);
      if (priorPreview) {
        return NextResponse.json(
          { error: "This workspace already used its complimentary video preview.", existingJobId: priorPreview.id },
          { status: 409 },
        );
      }
    } else {
      const guard = await guardAiRequest(request.headers.get("authorization"), "video");
      billingSource = guard.billingSource;
      remainingTrialUses = guard.remainingTrialUses;
    }
    const prompt = body.prompt?.trim() ?? "";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
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
    const rows = await supabaseServiceRoleRequest<VideoJobRow[]>("/rest/v1/video_jobs?select=id,status,provider,provider_job_id,result_url,created_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: jobId,
        user_id: user.id,
        provider: "fal",
        provider_job_id: null,
        prompt,
        status: "queued",
        result_url: null,
        result_payload: {
          remixMode,
          sourceOutputId: sourceOutputId || null,
          sourceVideoJobId: null,
          hasInputReferenceImage: remixMode === "animate_image" ? Boolean(inputReferenceImage) : false,
          workspacePreview: isWorkspacePreview,
          previewAccountId: isWorkspacePreview ? body.accountId?.trim() : null,
          previewWatermarkRequired: isWorkspacePreview,
        },
      }),
    });

    if (!rows?.[0]) throw new Error("VIDEO_LEDGER_CREATE_FAILED");

    const falJob = await createFalVideoJob({
      prompt,
      durationSeconds: body.durationSeconds,
      inputReferenceImageUrl: remixMode === "animate_image" ? inputReferenceImage : undefined,
    });

    const updatedRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
      `/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,status,provider,provider_job_id,result_url,created_at`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          provider_job_id: falJob.providerJobId,
          status: falJob.status,
          updated_at: new Date().toISOString(),
          result_payload: {
            model: falJob.model,
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
      trial_uses_remaining: remainingTrialUses,
      warning: null,
    });
  } catch (error) {
    if (pendingJobId) {
      const failureCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "VIDEO_PROVIDER_SUBMISSION_FAILED";
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
    const guardResponse = toAiGuardErrorResponse(error);
    if (guardResponse) return guardResponse;
    const message = error instanceof Error ? error.message : "";
    console.error("wovo_video_create_failed", {
      code: /^[A-Z0-9_]+$/.test(message) ? message : "VIDEO_CREATE_FAILED",
      ledgerCreated: Boolean(pendingJobId),
    });
    if (message.includes("video_jobs_workspace_preview_unique_idx")) {
      return NextResponse.json({ error: "This workspace already used its complimentary video preview." }, { status: 409 });
    }
    const safeMessage = message.startsWith("FAL_") || message.startsWith("VIDEO_")
      ? "The video provider is temporarily unavailable. Please try again shortly."
      : "Unable to create the preview right now. Please try again.";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
