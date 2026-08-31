import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

type MediaKind = "video" | "music";

function signingKey() {
  const key = getEnv("WOVO_MEDIA_SIGNING_KEY") || getEnv("CRON_SECRET");
  if (!key || key.length < 24) throw new Error("MEDIA_SIGNING_NOT_CONFIGURED");
  return key;
}

function payload(kind: MediaKind, jobId: string, ownerUserId: string, expires: number) {
  return `${kind}:${jobId}:${ownerUserId}:${expires}`;
}

export function signMediaAccess(kind: MediaKind, jobId: string, ownerUserId: string, expires: number) {
  return createHmac("sha256", signingKey()).update(payload(kind, jobId, ownerUserId, expires)).digest("base64url");
}

export function verifyMediaAccess(input: {
  kind: MediaKind;
  jobId: string;
  ownerUserId: string;
  expires: string | null;
  signature: string | null;
}) {
  const expires = Number(input.expires);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 32 * 24 * 60 * 60) {
    return false;
  }
  if (!input.signature || !/^[A-Za-z0-9_-]{40,60}$/.test(input.signature)) return false;
  const expected = signMediaAccess(input.kind, input.jobId, input.ownerUserId, expires);
  const suppliedBytes = Buffer.from(input.signature);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export function signedMediaUrl(requestUrl: string, input: {
  kind: MediaKind;
  jobId: string;
  ownerUserId: string;
  lifetimeSeconds?: number;
}) {
  const request = new URL(requestUrl);
  const configuredOrigin = getEnv("NEXT_PUBLIC_SITE_URL") || getEnv("WOVO_PUBLIC_SITE_URL");
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : request.origin;
  const expires = Math.floor(Date.now() / 1000) + Math.max(300, Math.min(input.lifetimeSeconds ?? 24 * 60 * 60, 30 * 24 * 60 * 60));
  const signature = signMediaAccess(input.kind, input.jobId, input.ownerUserId, expires);
  const url = new URL(`/api/wovo/${input.kind}/${encodeURIComponent(input.jobId)}`, origin);
  url.searchParams.set("content", "1");
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature);
  return url.toString();
}
