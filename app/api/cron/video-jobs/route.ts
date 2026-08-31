import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { reconcileRecentVideoJobs } from "@/lib/wovo-ai/video-reconciler";
import { reconcileRecentMusicJobs } from "@/lib/wovo-ai/music-reconciler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [video, music] = await Promise.all([
      reconcileRecentVideoJobs(6),
      reconcileRecentMusicJobs(6),
    ]);
    const failures = [...video.failures, ...music.failures];
    if (failures.length > 0) {
      console.error("Media reconciliation completed with retryable failures", {
        failed: failures.length,
        codes: [...new Set(failures.map((failure) => failure.code))],
      });
    }
    return NextResponse.json({ video, music }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = /^[A-Z0-9_]{3,80}$/.test(message) ? message : "MEDIA_RECONCILER_FAILED";
    console.error("Media reconciliation failed before polling", { code });
    return NextResponse.json(
      { video: null, music: null, workerError: code },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
