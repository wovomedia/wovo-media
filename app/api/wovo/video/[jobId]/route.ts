import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { downloadSoraVideoContent, getSoraJobStatus } from "@/lib/wovo-ai/sora";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";

type VideoJobRow = {
  id: string;
  user_id: string;
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
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const isContentRequest = new URL(request.url).searchParams.get("content") === "1";
    const { jobId } = await params;

    const rows = await supabaseServiceRoleRequest<VideoJobRow[]>(
      `/rest/v1/video_jobs?select=id,user_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&limit=1`,
    );
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Video job not found." }, { status: 404 });
    }

    const isOwner = row.user_id === user.id;
    if (!isContentRequest && !isOwner) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const currentStatus = normalizeJobStatus(row.status);

    if (isContentRequest) {
      if (!isOwner) {
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

      const content = await downloadSoraVideoContent(row.provider_job_id);
      return new Response(content.bytes, {
        status: 200,
        headers: {
          "Content-Type": content.contentType,
          "Content-Disposition": content.contentDisposition,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    if (currentStatus === "completed" || currentStatus === "failed" || !row.provider_job_id) {
      if (currentStatus === "completed" && !row.result_url) {
        const patched = await supabaseServiceRoleRequest<VideoJobRow[]>(
          `/rest/v1/video_jobs?select=id,user_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              result_url: getInternalResultUrl(jobId),
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return NextResponse.json({ job: patched?.[0] ?? row });
      }
      return NextResponse.json({ job: row });
    }

    try {
      const status = await getSoraJobStatus(row.provider_job_id);
      const normalized = normalizeJobStatus(status.status);
      const resultUrl = normalized === "completed" ? getInternalResultUrl(jobId) : row.result_url;
      const failureMessage = normalized === "failed" ? String(status.raw.error?.message ?? "Sora job failed.") : null;

      const patchRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
        `/rest/v1/video_jobs?select=id,user_id,status,provider,provider_job_id,result_url,result_payload,error,updated_at,created_at&id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: normalized,
            result_url: resultUrl,
            result_payload: status.raw,
            error: failureMessage,
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return NextResponse.json({ job: patchRows?.[0] ?? row });
    } catch (pollError) {
      return NextResponse.json({
        job: row,
        warning: pollError instanceof Error ? pollError.message : "Unable to refresh Sora job state.",
      });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Sora job." },
      { status: 500 },
    );
  }
}
