import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

export const META_API_VERSION = "v24.0";
export const META_FACEBOOK_LOGIN_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_manage_metadata",
  "pages_manage_posts",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "instagram_content_publish",
] as const;

function encryptionKey() {
  const value = getEnv("META_TOKEN_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("META_TOKEN_ENCRYPTION_KEY_MISSING");
  return Buffer.from(value, "hex");
}

export function encryptMetaToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decryptMetaToken(record: { token_ciphertext: string; token_iv: string; token_tag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(record.token_iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.token_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.token_ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function hashMetaState(state: string) { return createHash("sha256").update(state).digest("hex"); }

export function metaPublishingScaffoldStatus() {
  const appConfigured = Boolean(getEnv("META_APP_ID") && getEnv("META_APP_SECRET"));
  const tokenEncryptionConfigured = /^[a-f0-9]{64}$/i.test(getEnv("META_TOKEN_ENCRYPTION_KEY"));
  const featureEnabled = getEnv("WOVO_META_PUBLISHING_ENABLED") === "true";
  return {
    featureEnabled,
    appConfigured,
    tokenEncryptionConfigured,
    backgroundJobsConfigured: Boolean(getEnv("CRON_SECRET")),
    launchState: featureEnabled && appConfigured && tokenEncryptionConfigured ? "connection_ready" as const : "blocked" as const,
  };
}

export function metaRedirectUrl(siteUrl: string) { return `${siteUrl.replace(/\/$/, "")}/api/integrations/meta/callback`; }

export async function metaGraph<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `https://graph.facebook.com/${META_API_VERSION}/${path.replace(/^\//, "")}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/x-www-form-urlencoded");
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = await response.json() as T & { error?: { message?: string; code?: number } };
  if (!response.ok || payload.error) throw new Error(`META_${payload.error?.code ?? response.status}:${payload.error?.message ?? "Provider request failed"}`);
  return payload;
}
