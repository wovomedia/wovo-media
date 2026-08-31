import "server-only";

import { getEnv } from "@/lib/env";

export async function jsonProviderRequest<T>(url: string, init: RequestInit, prefix: string): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let payload: unknown = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const nested = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
    const code = String(nested.code ?? record.error_code ?? response.status).replace(/[^A-Z0-9_]/gi, "_");
    throw new Error(`${prefix}_${code}`);
  }
  return payload as T;
}

export function requireStableWovoMediaUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("MEDIA_URL_INVALID"); }
  if (url.protocol !== "https:") throw new Error("MEDIA_URL_HTTPS_REQUIRED");
  const configured = getEnv("WOVO_SOCIAL_MEDIA_HOST") || "wovomedia.com";
  const hosts = configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!hosts.includes(url.hostname.toLowerCase())) throw new Error("MEDIA_URL_NOT_WOVO_CONTROLLED");
  return url.toString();
}

export function futureIso(seconds: number | undefined) {
  return Number.isFinite(seconds) ? new Date(Date.now() + Math.max(0, Number(seconds)) * 1000).toISOString() : null;
}

export function sanitizedProviderMessage(code: string) {
  const messages: Record<string, string> = {
    ACCESS_TOKEN_INVALID: "Reconnect this account to continue publishing.",
    SCOPE_NOT_AUTHORIZED: "This account did not grant the required publishing permission.",
    OAUTH_STATE_INVALID_OR_EXPIRED: "The connection request expired. Start again from WOVO.",
    MEDIA_URL_NOT_WOVO_CONTROLLED: "Save the media to WOVO before publishing it.",
  };
  return messages[code] ?? "The provider could not verify this action. Nothing was marked published.";
}
