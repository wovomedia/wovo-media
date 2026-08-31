import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { loadMetaConnection } from "@/lib/meta/publishing";

function safeEqual(expected: Buffer, actual: Buffer) {
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function safeEqualHex(expectedHex: string, actualHex: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || !/^[a-f0-9]{64}$/i.test(actualHex)) return false;
  return safeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(actualHex, "hex"));
}

export async function authorizedCronRequest(request: Request) {
  const cronSecret = getEnv("CRON_SECRET");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (cronSecret && bearer && safeEqual(Buffer.from(cronSecret), Buffer.from(bearer))) return true;

  const bucket = request.headers.get("x-wovo-scheduler-bucket") ?? "";
  const signature = request.headers.get("x-wovo-scheduler-signature") ?? "";
  if (!/^\d{6,12}$/.test(bucket)) return false;
  const bucketNumber = Number(bucket);
  const currentBucket = Math.floor(Date.now() / 3_600_000);
  if (!Number.isSafeInteger(bucketNumber) || Math.abs(currentBucket - bucketNumber) > 1) return false;

  const connection = await loadMetaConnection({ ownerScope: true });
  if (!connection) return false;
  const pathname = new URL(request.url).pathname;
  const expected = createHmac("sha256", connection.token_ciphertext)
    .update(`wovo-scheduler:${pathname}:${connection.id}:${bucket}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}
