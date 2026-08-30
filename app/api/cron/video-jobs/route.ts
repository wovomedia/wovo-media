import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { reconcileRecentVideoJobs } from "@/lib/wovo-ai/video-reconciler";

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
    const result = await reconcileRecentVideoJobs(6);
    if (result.failures.length > 0) {
      console.error("Video reconciliation completed with retryable failures", {
        failed: result.failures.length,
        codes: [...new Set(result.failures.map((failure) => failure.code))],
      });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = /^[A-Z0-9_]{3,80}$/.test(message) ? message : "VIDEO_RECONCILER_FAILED";
    console.error("Video reconciliation failed before polling", { code });
    return NextResponse.json(
      { found: 0, completed: 0, failed: 0, processing: 0, expired: 0, failures: [], workerError: code },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
