import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { enqueueWovoDailyVideoDraft, loadMetaConnection, processMetaPublishJobs } from "@/lib/meta/publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeEqualHex(expectedHex: string, actualHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || !/^[a-f0-9]{64}$/i.test(actualHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function authorized(request: Request): Promise<boolean> {
  const secret = getEnv("CRON_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (secret && supplied) {
    const expected = Buffer.from(secret);
    const actual = Buffer.from(supplied);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }

  const bucket = request.headers.get("x-wovo-meta-scheduler-bucket") ?? "";
  const signature = request.headers.get("x-wovo-meta-scheduler-signature") ?? "";
  if (!/^\d{6,12}$/.test(bucket)) return false;
  const bucketNumber = Number(bucket);
  const currentBucket = Math.floor(Date.now() / 3_600_000);
  if (!Number.isSafeInteger(bucketNumber) || Math.abs(currentBucket - bucketNumber) > 1) return false;
  const connection = await loadMetaConnection({ ownerScope: true });
  if (!connection) return false;
  const expectedSignature = createHmac("sha256", connection.token_ciphertext)
    .update(`wovo-meta-scheduler:${connection.id}:${bucket}`)
    .digest("hex");
  return safeEqualHex(expectedSignature, signature);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const generated = await enqueueWovoDailyVideoDraft().catch((error) => ({
    enqueued: 0,
    reason: error instanceof Error ? error.message.slice(0, 120) : "enqueue_failed",
  }));
  try {
    const processed = await processMetaPublishJobs(6);
    if (processed.failed > 0) {
      console.error("Meta publishing run completed with provider failures", {
        failed: processed.failed,
        codes: [...new Set(processed.failures.map((failure) => failure.code))],
      });
    }
    return NextResponse.json({ generated, ...processed }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error
      ? error.message.split(":")[0].replace(/[^A-Z0-9_]/gi, "_").slice(0, 80)
      : "META_WORKER_FAILED";
    console.error("Meta publishing worker failed before provider delivery", { code });
    return NextResponse.json(
      { generated, found: 0, published: 0, failed: 0, workerError: code || "META_WORKER_FAILED" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
