import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { downloadFalMusic, getFalMusicJob } from "@/lib/wovo-ai/fal-music";
import { signedMediaUrl, verifyMediaAccess } from "@/lib/wovo-ai/media-token";

export const runtime = "nodejs";

type MusicJobRow = {
  id: string;
  user_id: string;
  account_id: string;
  usage_request_id: string | null;
  provider: string;
  provider_job_id: string | null;
  model: string;
  quality: "economy" | "premium";
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

function storageClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("MUSIC_STORAGE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function storagePath(row: MusicJobRow, contentType: string) {
  const extension = contentType.includes("mpeg") ? "mp3" : contentType.includes("ogg") ? "ogg" : "wav";
  return `${row.user_id}/generated/music/${row.id}.${extension}`;
}

function visibleJob(requestUrl: string, row: MusicJobRow) {
  let mediaUrl: string | null = null;
  if (row.status === "completed" && row.storage_path) {
    try { mediaUrl = signedMediaUrl(requestUrl, { kind: "music", jobId: row.id, ownerUserId: row.user_id, lifetimeSeconds: 30 * 24 * 60 * 60 }); }
    catch { mediaUrl = null; }
  }
  return {
    id: row.id, accountId: row.account_id, model: row.model, quality: row.quality,
    prompt: row.prompt, durationSeconds: row.duration_seconds, status: row.status,
    mediaUrl, error: row.error ? "The music provider could not complete this track." : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const requestUrl = new URL(request.url);
    const rows = await supabaseServiceRoleRequest<MusicJobRow[]>(
      `/rest/v1/wovo_music_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&limit=1`,
    );
    const row = rows?.[0];
    if (!row) return NextResponse.json({ error: "Music project not found." }, { status: 404 });
    const contentRequest = requestUrl.searchParams.get("content") === "1";
    const signed = contentRequest && verifyMediaAccess({
      kind: "music", jobId: row.id, ownerUserId: row.user_id,
      expires: requestUrl.searchParams.get("expires"), signature: requestUrl.searchParams.get("signature"),
    });
    if (!signed) {
      const context = await requirePortalContext(request.headers.get("authorization"));
      await assertPortalAccountAccess(context, row.account_id);
    }
    if (contentRequest) {
      if (row.status !== "completed" || !row.storage_path) return NextResponse.json({ error: "Music is not ready yet." }, { status: 409 });
      const stored = await storageClient().storage.from("wovo-portal-assets").download(row.storage_path);
      if (stored.error || !stored.data) return NextResponse.json({ error: "Music file is unavailable." }, { status: 404 });
      const contentType = typeof row.result_payload?.contentType === "string" ? row.result_payload.contentType : "audio/wav";
      return new Response(await stored.data.arrayBuffer(), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="wovo-${row.id}.${contentType.includes("mpeg") ? "mp3" : "wav"}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    if (["completed", "failed"].includes(row.status) || !row.provider_job_id) {
      return NextResponse.json({ job: visibleJob(request.url, row) });
    }
    const provider = await getFalMusicJob(row.model, row.provider_job_id);
    if (provider.status === "failed") {
      const failed = row.usage_request_id
        ? await supabaseServiceRoleRequest<MusicJobRow | MusicJobRow[]>("/rest/v1/rpc/wovo_music_fail_job", {
            method: "POST", body: JSON.stringify({ p_job_id: row.id, p_actor_user_id: row.user_id, p_error_code: "music_provider_failed" }),
          })
        : await supabaseServiceRoleRequest<MusicJobRow[]>(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}&select=*`, {
            method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "failed", error: "music_provider_failed", updated_at: new Date().toISOString() }),
          });
      const updated = Array.isArray(failed) ? failed[0] ?? row : failed ?? row;
      return NextResponse.json({ job: visibleJob(request.url, updated) });
    }
    if (provider.status !== "completed") {
      const updated = await supabaseServiceRoleRequest<MusicJobRow[]>(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}&select=*`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: provider.status, updated_at: new Date().toISOString() }),
      });
      return NextResponse.json({ job: visibleJob(request.url, updated?.[0] ?? row) });
    }
    if (!provider.remoteUrl) throw new Error("FAL_MUSIC_RESULT_MISSING");
    const downloaded = await downloadFalMusic(provider.remoteUrl);
    const path = storagePath(row, downloaded.contentType);
    const uploaded = await storageClient().storage.from("wovo-portal-assets").upload(path, new Uint8Array(downloaded.bytes), {
      contentType: downloaded.contentType, upsert: false,
    });
    if (uploaded.error && !uploaded.error.message.toLowerCase().includes("already exists")) throw new Error("MUSIC_STORAGE_UPLOAD_FAILED");
    let completed: MusicJobRow | null = null;
    if (row.usage_request_id) {
      const result = await supabaseServiceRoleRequest<MusicJobRow | MusicJobRow[]>("/rest/v1/rpc/wovo_music_complete_job", {
        method: "POST",
        body: JSON.stringify({
          p_job_id: row.id, p_actor_user_id: row.user_id,
          p_result_url: `/api/wovo/music/${encodeURIComponent(row.id)}?content=1`, p_storage_path: path,
          p_payload: { contentType: downloaded.contentType, providerCompleted: true },
        }),
      });
      completed = Array.isArray(result) ? result[0] ?? null : result;
    } else {
      const result = await supabaseServiceRoleRequest<MusicJobRow[]>(`/rest/v1/wovo_music_jobs?id=eq.${encodeURIComponent(row.id)}&select=*`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "completed", result_url: `/api/wovo/music/${encodeURIComponent(row.id)}?content=1`, storage_path: path,
          result_payload: { ...(row.result_payload ?? {}), contentType: downloaded.contentType, providerCompleted: true, ownerExempt: true },
          error: null, updated_at: new Date().toISOString(),
        }),
      });
      completed = result?.[0] ?? null;
    }
    return NextResponse.json({ job: visibleJob(request.url, completed ?? row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MUSIC_REFRESH_FAILED";
    const status = /Missing bearer|verify session/.test(message) ? 401 : 500;
    console.error("wovo_music_refresh_failed", { code: /^[A-Z0-9_]+$/.test(message) ? message : "MUSIC_REFRESH_FAILED" });
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Unable to refresh this music project." }, { status });
  }
}
