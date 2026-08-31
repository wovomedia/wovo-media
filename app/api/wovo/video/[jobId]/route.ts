import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { downloadFalVideo, getFalVideoJob } from "@/lib/wovo-ai/fal-video";
import { getEnv } from "@/lib/env";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { signedMediaUrl, verifyMediaAccess } from "@/lib/wovo-ai/media-token";

type VideoJobRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  usage_request_id: string | null;
  status: string;
  provider: string;
  provider_job_id: string | null;
  result_url: string | null;
  result_payload: Record<string, unknown> | null;
  error: string | null;
  updated_at: string;
  created_at: string;
};

type GenerationRow = {
  id: string;
  user_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

function normalizeJobStatus(status: string): string {
  const value = status.trim().toLowerCase();
  if (!value) return "processing";
  if (["queued", "processing", "running", "pending"].includes(value)) return "processing";
  if (["in_progress"].includes(value)) return "processing";
  if (["completed", "succeeded", "success"].includes(value)) return "completed";
  if (["failed", "canceled", "cancelled", "error"].includes(value)) return "failed";
  return value;
}

function getInternalResultUrl(jobId: string): string {
  return `/api/wovo/video/${encodeURIComponent(jobId)}?content=1`;
}

function visibleJob(requestUrl: string, row: VideoJobRow) {
  if (normalizeJobStatus(row.status) !== "completed") return row;
  try {
    return {
      ...row,
      result_url: signedMediaUrl(requestUrl, {
        kind: "video",
        jobId: row.id,
        ownerUserId: row.user_id,
        lifetimeSeconds: 30 * 24 * 60 * 60,
      }),
    };
  } catch {
    return row;
  }
}

function adminStorage() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("VIDEO_STORAGE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function storagePath(row: VideoJobRow) {
  return `${row.user_id}/generated/video/${row.id}.mp4`;
}

function isDemoVideoJob(row: VideoJobRow): boolean {
  return row.provider === "demo" || (row.provider_job_id ?? "").startsWith("demo_");
}

function isSafeDemoAssetPath(value: string | null | undefined): value is string {
  const normalized = (value ?? "").trim();
  return normalized.startsWith("/videos/") && !normalized.includes("..");
}

async function readDemoVideoAsset(assetPath: string): Promise<ArrayBuffer> {
  const absolutePath = path.join(process.cwd(), "public", assetPath.replace(/^\//, ""));
  const bytes = await readFile(absolutePath);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function canViewerAccessSharedVideo(jobId: string, ownerUserId: string): Promise<boolean> {
  const generationRows = await supabaseServiceRoleRequest<GenerationRow[]>(
    `/rest/v1/generations?select=id,user_id,input,output&user_id=eq.${encodeURIComponent(ownerUserId)}&order=created_at.desc&limit=200`
  );

  for (const row of generationRows ?? []) {
    if (!isEligibleFeedPost(row)) continue;
    const output = asRecord(row.output);
    const extra = asRecord(output.extra);
    const rowJobId = asString(extra.videoJobId).trim().toLowerCase();
    if (rowJobId === jobId.toLowerCase()) {
      return true;
    }
  }

  return false;
}

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const requestUrl = new URL(request.url);
    const isContentRequest = requestUrl.searchParams.get("content") === "1";
    const { jobId } = await params;

    const rows = await supabaseServiceRoleRequest<VideoJobRow[]>(
      `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&limit=1`,
    );
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Video job not found." }, { status: 404 });
    }

    const signedContentAccess = isContentRequest && verifyMediaAccess({
      kind: "video",
      jobId: row.id,
      ownerUserId: row.user_id,
      expires: requestUrl.searchParams.get("expires"),
      signature: requestUrl.searchParams.get("signature"),
    });
    const user = signedContentAccess
      ? null
      : (await requireServerUser(request.headers.get("authorization"))).user;

    const isOwner = user?.id === row.user_id;
    const actorUserId = user?.id ?? row.user_id;
    if (!isContentRequest && !isOwner) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const currentStatus = normalizeJobStatus(row.status);

    if (isContentRequest) {
      if (!signedContentAccess && !isOwner) {
        const canView = await canViewerAccessSharedVideo(jobId, row.user_id);
        if (!canView) {
          return NextResponse.json({ error: "This video is not publicly available." }, { status: 403 });
        }
      }

      if (currentStatus !== "completed") {
        return NextResponse.json({ error: "Video is not ready yet." }, { status: 409 });
      }

      if (isDemoVideoJob(row) && isSafeDemoAssetPath(row.result_url)) {
        const payload = await readDemoVideoAsset(row.result_url);
        return new Response(payload, {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `inline; filename="${row.id}.mp4"`,
            "Cache-Control": "private, max-age=60",
          },
        });
      }
      if (!row.provider_job_id) {
        return NextResponse.json({ error: "Video is not ready yet." }, { status: 409 });
      }

      const stored = await adminStorage().storage.from("wovo-portal-assets").download(storagePath(row));
      if (stored.error || !stored.data) return NextResponse.json({ error: "Video file is unavailable." }, { status: 404 });
      return new Response(await stored.data.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `inline; filename="${row.id}.mp4"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    if (currentStatus === "completed" || currentStatus === "failed" || !row.provider_job_id) {
      if (currentStatus === "completed" && !row.result_url) {
        const patched = await supabaseServiceRoleRequest<VideoJobRow[]>(
          `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(actorUserId)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              result_url: getInternalResultUrl(jobId),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return NextResponse.json({ job: visibleJob(request.url, patched?.[0] ?? row) });
      }
      return NextResponse.json({ job: visibleJob(request.url, row) });
    }

    try {
      const model = asString(asRecord(row.result_payload).model);
      if (row.provider !== "fal" || !model) throw new Error("VIDEO_PROVIDER_JOB_INVALID");
      const status = await getFalVideoJob(model, row.provider_job_id);
      const normalized = normalizeJobStatus(status.status);
      const resultUrl = normalized === "completed" ? getInternalResultUrl(jobId) : row.result_url;
      const failureMessage = normalized === "failed" ? "Video provider could not complete this render." : null;
      if (normalized === "completed") {
        const remoteUrl = status.data?.video?.url;
        if (!remoteUrl) throw new Error("FAL_VIDEO_RESULT_MISSING");
        const content = await downloadFalVideo(remoteUrl);
        const uploaded = await adminStorage().storage.from("wovo-portal-assets").upload(
          storagePath(row),
          new Uint8Array(content.bytes),
          { contentType: "video/mp4", upsert: false },
        );
        if (uploaded.error && !uploaded.error.message.toLowerCase().includes("already exists")) throw uploaded.error;
      }

      if (normalized === "failed" && row.usage_request_id) {
        const failed = await supabaseServiceRoleRequest<VideoJobRow | VideoJobRow[]>(
          "/rest/v1/rpc/wovo_video_fail_job",
          {
            method: "POST",
            body: JSON.stringify({
              p_job_id: row.id,
              p_actor_user_id: actorUserId,
              p_error_code: "video_provider_failed",
            }),
          },
        );
        return NextResponse.json({ job: visibleJob(request.url, Array.isArray(failed) ? failed[0] ?? row : failed ?? row) });
      }

      if (normalized === "completed" && row.usage_request_id) {
        const completed = await supabaseServiceRoleRequest<VideoJobRow | VideoJobRow[]>(
          "/rest/v1/rpc/wovo_video_complete_job",
          {
            method: "POST",
            body: JSON.stringify({
              p_job_id: row.id,
              p_actor_user_id: actorUserId,
              p_result_url: resultUrl,
              p_payload: { providerCompleted: true },
            }),
          },
        );
        return NextResponse.json({ job: visibleJob(request.url, Array.isArray(completed) ? completed[0] ?? row : completed ?? row) });
      }

      const patchRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
        `/rest/v1/video_jobs?select=id,user_id,account_id,usage_request_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(actorUserId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: normalized,
            result_url: resultUrl,
            result_payload: { ...asRecord(row.result_payload), providerCompleted: normalized === "completed" },
            error: failureMessage,
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return NextResponse.json({ job: visibleJob(request.url, patchRows?.[0] ?? row) });
    } catch (pollError) {
      return NextResponse.json({
        job: row,
        warning: pollError instanceof Error ? pollError.message : "Unable to refresh video job state.",
      });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load video job." },
      { status: 500 },
    );
  }
}
