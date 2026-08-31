import "server-only";

import { getEnv } from "@/lib/env";
import { decryptMetaToken, metaGraph } from "@/lib/meta/integration";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import type { ConnectionVerification, SocialConnectionRecord } from "@/lib/publishing/types";

export type LegacyMetaConnection = {
  id: string;
  page_id: string;
  page_name: string;
  instagram_user_id: string | null;
  instagram_username: string | null;
  token_ciphertext: string;
  token_iv: string;
  token_tag: string;
  token_expires_at: string | null;
  granted_scopes: string[];
  status: string;
  revoked_at: string | null;
};

export async function metaContext(connection: SocialConnectionRecord) {
  const legacyId = typeof connection.metadata_json?.legacy_meta_connection_id === "string"
    ? connection.metadata_json.legacy_meta_connection_id
    : "";
  if (!legacyId) throw new Error("META_LEGACY_CONNECTION_MISSING");
  const rows = await supabaseServiceRoleRequest<LegacyMetaConnection[]>(
    `/rest/v1/wovo_meta_connections?select=id,page_id,page_name,instagram_user_id,instagram_username,token_ciphertext,token_iv,token_tag,token_expires_at,granted_scopes,status,revoked_at&id=eq.${encodeURIComponent(legacyId)}&status=eq.healthy&revoked_at=is.null&limit=1`,
  );
  const legacy = rows?.[0];
  if (!legacy) throw new Error("META_CONNECTION_NOT_ACTIONABLE");
  return { legacy, token: decryptMetaToken(legacy) };
}

export async function verifyMetaDestination(connection: SocialConnectionRecord, provider: "facebook" | "instagram"): Promise<ConnectionVerification> {
  try {
    const { legacy, token } = await metaContext(connection);
    const appId = getEnv("META_APP_ID");
    const appSecret = getEnv("META_APP_SECRET");
    if (!appId || !appSecret) throw new Error("META_APP_NOT_CONFIGURED");
    const appToken = `${appId}|${appSecret}`;
    const debug = await metaGraph<{
      data?: { is_valid?: boolean; app_id?: string; expires_at?: number; scopes?: string[]; user_id?: string };
    }>(`debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`, appToken);
    if (debug.data?.is_valid !== true || debug.data.app_id !== appId) throw new Error("META_TOKEN_INVALID");
    const page = await metaGraph<{
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>(`${legacy.page_id}?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`, token);
    if (!page.id) throw new Error("META_PAGE_NOT_AVAILABLE");
    const scopes = debug.data.scopes ?? legacy.granted_scopes ?? [];
    const required = provider === "facebook" ? ["pages_manage_posts"] : ["instagram_basic", "instagram_content_publish"];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (provider === "instagram" && !page.instagram_business_account?.id) {
      return { ok: false, status: "action_required", errorCode: "META_INSTAGRAM_PROFESSIONAL_ACCOUNT_MISSING", userMessage: "Link an Instagram professional account to this Facebook Page." };
    }
    if (missing.length) {
      return { ok: false, status: "action_required", scopes, errorCode: "META_REQUIRED_SCOPES_MISSING", userMessage: "Reconnect Meta and approve the required publishing permissions." };
    }
    return {
      ok: true,
      status: "publishing_ready",
      accountId: provider === "facebook" ? page.id : page.instagram_business_account?.id,
      accountName: provider === "facebook" ? page.name : page.instagram_business_account?.username,
      scopes,
      metadata: {
        facebookPageId: page.id,
        instagramUserId: page.instagram_business_account?.id ?? null,
        instagramUsername: page.instagram_business_account?.username ?? null,
        tokenExpiresAt: debug.data.expires_at ? new Date(debug.data.expires_at * 1000).toISOString() : legacy.token_expires_at,
      },
    };
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "META_VERIFY_FAILED";
    return {
      ok: false,
      status: /TOKEN|AUTH|SCOPE/.test(code) ? "action_required" : "error",
      errorCode: code,
      userMessage: /TOKEN|AUTH/.test(code) ? "Reconnect Facebook and Instagram to restore publishing access." : "Meta could not confirm publishing access.",
    };
  }
}

export async function waitForInstagramContainer(containerId: string, token: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await metaGraph<{ status_code?: string }>(`${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`, token);
    if (result.status_code === "FINISHED") return;
    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") throw new Error(`META_CONTAINER_${result.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("META_CONTAINER_TIMEOUT");
}

export async function publishFacebookReel(pageId: string, mediaUrl: string, caption: string, token: string) {
  const initialized = await metaGraph<{ video_id?: string; upload_url?: string }>(`${pageId}/video_reels`, token, {
    method: "POST",
    body: new URLSearchParams({ upload_phase: "start", access_token: token }),
  });
  const videoId = initialized.video_id?.trim() ?? "";
  const uploadUrl = initialized.upload_url?.trim() ?? "";
  if (!videoId || !uploadUrl) throw new Error("META_REEL_UPLOAD_SESSION_INVALID");
  const parsed = new URL(uploadUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "rupload.facebook.com") throw new Error("META_REEL_UPLOAD_HOST_INVALID");
  const uploaded = await metaGraph<{ success?: boolean }>(uploadUrl, token, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: mediaUrl },
  });
  if (uploaded.success !== true) throw new Error("META_REEL_UPLOAD_NOT_CONFIRMED");
  const finished = await metaGraph<{ success?: boolean }>(`${pageId}/video_reels`, token, {
    method: "POST",
    body: new URLSearchParams({ access_token: token, video_id: videoId, upload_phase: "finish", video_state: "PUBLISHED", description: caption }),
  });
  if (finished.success !== true) throw new Error("META_REEL_PUBLISH_NOT_CONFIRMED");
  return videoId;
}
