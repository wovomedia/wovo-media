import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { downloadFalMusic, getFalMusicJob } from "@/lib/wovo-ai/fal-music";

type MusicRow = {
  id: string;
  user_id: string;
  account_id: string;
  usage_request_id: string | null;
  provider_job_id: string | null;
  model: string;
  status: string;
  result_payload: Record<string, unknown> | null;
};

function storageClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("MUSIC_STORAGE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function errorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "";
  return /^[A-Z0-9_]{3,80}$/.test(value) ? value : "MUSIC_RECONCILE_FAILED";
}

async function fail(row: MusicRow, code: string) {
  if (row.usage_request_id) {
    await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_music_fail_job", {
      method: "POST", body: JSON.stringify({ p_job_id: row.id, p_actor_user_id: row.user_id, p_error_code: code }),
    });
  } else {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error: code, updated_at: new Date().toISOString() }),
    });
  }
}

async function reconcile(row: MusicRow): Promise<"completed" | "failed" | "processing"> {
  if (!row.provider_job_id || !row.model) throw new Error("MUSIC_PROVIDER_JOB_INVALID");
  const provider = await getFalMusicJob(row.model, row.provider_job_id);
  if (provider.status === "failed") {
    await fail(row, "music_provider_failed");
    return "failed";
  }
  if (provider.status !== "completed") {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: provider.status, updated_at: new Date().toISOString() }),
    });
    return "processing";
  }
  if (!provider.remoteUrl) throw new Error("FAL_MUSIC_RESULT_MISSING");
  const downloaded = await downloadFalMusic(provider.remoteUrl);
  const extension = downloaded.contentType.includes("mpeg") ? "mp3" : downloaded.contentType.includes("ogg") ? "ogg" : "wav";
  const path = `${row.user_id}/generated/music/${row.id}.${extension}`;
  const uploaded = await storageClient().storage.from("wovo-portal-assets").upload(path, new Uint8Array(downloaded.bytes), {
    contentType: downloaded.contentType, upsert: false,
  });
  if (uploaded.error && !uploaded.error.message.toLowerCase().includes("already exists")) throw new Error("MUSIC_STORAGE_UPLOAD_FAILED");
  if (row.usage_request_id) {
    await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_music_complete_job", {
      method: "POST",
      body: JSON.stringify({
        p_job_id: row.id, p_actor_user_id: row.user_id,
        p_result_url: `/api/wovo/music/${encodeURIComponent(row.id)}?content=1`, p_storage_path: path,
        p_payload: { contentType: downloaded.contentType, providerCompleted: true, reconciledBy: "media_cron" },
      }),
    });
  } else {
    await supabaseServiceRoleRequest(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "completed", result_url: `/api/wovo/music/${encodeURIComponent(row.id)}?content=1`, storage_path: path,
        result_payload: { ...(row.result_payload ?? {}), contentType: downloaded.contentType, providerCompleted: true, ownerExempt: true },
        error: null, updated_at: new Date().toISOString(),
      }),
    });
  }
  return "completed";
}

export async function reconcileRecentMusicJobs(limit = 6) {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 12));
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseServiceRoleRequest<MusicRow[]>(
    `/rest/v1/wovo_music_jobs?select=id,user_id,account_id,usage_request_id,provider_job_id,model,status,result_payload&provider_job_id=not.is.null&status=in.(queued,processing)&created_at=gte.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=${safeLimit}`,
  ) ?? [];
  const expired = await supabaseServiceRoleRequest<MusicRow[]>(
    `/rest/v1/wovo_music_jobs?select=id,user_id,account_id,usage_request_id,provider_job_id,model,status,result_payload&provider_job_id=not.is.null&status=in.(queued,processing)&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=${safeLimit}`,
  ) ?? [];
  const result = { found: rows.length, completed: 0, failed: 0, processing: 0, expired: 0, failures: [] as Array<{ jobId: string; code: string }> };
  for (const row of expired) {
    try { await fail(row, "music_reconciliation_window_expired"); result.expired += 1; }
    catch (error) { result.failures.push({ jobId: row.id, code: errorCode(error) }); }
  }
  for (const row of rows) {
    try { const status = await reconcile(row); result[status] += 1; }
    catch (error) { result.failures.push({ jobId: row.id, code: errorCode(error) }); }
  }
  return result;
}
