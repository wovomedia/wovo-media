import "server-only";

import { createClient } from "@supabase/supabase-js";
import { downloadFalVideo, getFalVideoJob } from "@/lib/wovo-ai/fal-video";
import { getEnv } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString } from "@/lib/wovo-ai/feed-utils";
import { createMetaReviewDraftsForAutomationVideo } from "@/lib/meta/publishing";

type ReconcileVideoRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  usage_request_id: string | null;
  provider: string;
  provider_job_id: string | null;
  status: string;
  result_payload: Record<string, unknown> | null;
};

type ReconcileResult = {
  found: number;
  completed: number;
  failed: number;
  processing: number;
  expired: number;
  failures: Array<{ jobId: string; code: string }>;
};

function storageClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("VIDEO_STORAGE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function storagePath(row: ReconcileVideoRow) {
  return `${row.user_id}/generated/video/${row.id}.mp4`;
}

function internalResultUrl(jobId: string) {
  return `/api/wovo/video/${encodeURIComponent(jobId)}?content=1`;
}

function sanitizedCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z0-9_]{3,80}$/.test(message) ? message : "VIDEO_RECONCILE_FAILED";
}

async function patchPreviewJob(
  row: ReconcileVideoRow,
  status: "queued" | "processing" | "completed" | "failed",
  resultPatch: Record<string, unknown> = {},
) {
  await supabaseServiceRoleRequest(`/rest/v1/video_jobs?id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(row.user_id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      result_url: status === "completed" ? internalResultUrl(row.id) : null,
      error: status === "failed" ? "Video provider could not complete this render." : null,
      result_payload: {
        ...asRecord(row.result_payload),
        providerCompleted: status === "completed",
        ...resultPatch,
      },
      updated_at: new Date().toISOString(),
    }),
  });
}

async function reconcileVideo(row: ReconcileVideoRow): Promise<"completed" | "failed" | "processing"> {
  const model = asString(asRecord(row.result_payload).model);
  if (row.provider !== "fal" || !row.provider_job_id || !model) {
    throw new Error("VIDEO_PROVIDER_JOB_INVALID");
  }
  const provider = await getFalVideoJob(model, row.provider_job_id);
  if (provider.status === "failed") {
    if (row.usage_request_id) {
      await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_video_fail_job", {
        method: "POST",
        body: JSON.stringify({
          p_job_id: row.id,
          p_actor_user_id: row.user_id,
          p_error_code: "video_provider_failed",
        }),
      });
    } else {
      await patchPreviewJob(row, "failed");
    }
    return "failed";
  }
  if (provider.status !== "completed") {
    const status = provider.status === "queued" ? "queued" : "processing";
    await supabaseServiceRoleRequest(`/rest/v1/video_jobs?id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(row.user_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
    return "processing";
  }

  const remoteUrl = provider.data?.video?.url;
  if (!remoteUrl) throw new Error("FAL_VIDEO_RESULT_MISSING");
  const content = await downloadFalVideo(remoteUrl);
  const uploaded = await storageClient().storage.from("wovo-portal-assets").upload(
    storagePath(row),
    new Uint8Array(content.bytes),
    { contentType: "video/mp4", upsert: false },
  );
  if (uploaded.error && !uploaded.error.message.toLowerCase().includes("already exists")) {
    throw new Error("VIDEO_STORAGE_UPLOAD_FAILED");
  }

  if (row.usage_request_id) {
    await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_video_complete_job", {
      method: "POST",
      body: JSON.stringify({
        p_job_id: row.id,
        p_actor_user_id: row.user_id,
        p_result_url: internalResultUrl(row.id),
        p_payload: { providerCompleted: true, reconciledBy: "video_cron" },
      }),
    });
  } else {
    const automation = asRecord(row.result_payload).wovoMetaAutomation === true;
    const metaDraftIds = automation ? await createMetaReviewDraftsForAutomationVideo(row) : [];
    await patchPreviewJob(row, "completed", automation ? {
      metaDraftsCreated: true,
      metaDraftIds,
      reconciledBy: "video_cron",
    } : { reconciledBy: "video_cron" });
  }
  return "completed";
}

export async function reconcileRecentVideoJobs(limit = 6): Promise<ReconcileResult> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 12));
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseServiceRoleRequest<ReconcileVideoRow[]>(
    `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,provider,provider_job_id,status,result_payload&provider=eq.fal&provider_job_id=not.is.null&status=in.(queued,processing)&created_at=gte.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=${safeLimit}`,
  );
  const expiredRows = await supabaseServiceRoleRequest<ReconcileVideoRow[]>(
    `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,provider,provider_job_id,status,result_payload&provider=eq.fal&usage_request_id=not.is.null&status=in.(queued,processing)&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=${safeLimit}`,
  );
  const result: ReconcileResult = {
    found: rows?.length ?? 0,
    completed: 0,
    failed: 0,
    processing: 0,
    expired: 0,
    failures: [],
  };
  for (const row of expiredRows ?? []) {
    try {
      await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_video_fail_job", {
        method: "POST",
        body: JSON.stringify({
          p_job_id: row.id,
          p_actor_user_id: row.user_id,
          p_error_code: "video_reconciliation_window_expired",
        }),
      });
      result.expired += 1;
    } catch (error) {
      result.failures.push({ jobId: row.id, code: sanitizedCode(error) });
    }
  }
  for (const row of rows ?? []) {
    try {
      const status = await reconcileVideo(row);
      result[status] += 1;
    } catch (error) {
      result.failures.push({ jobId: row.id, code: sanitizedCode(error) });
    }
  }
  return result;
}
