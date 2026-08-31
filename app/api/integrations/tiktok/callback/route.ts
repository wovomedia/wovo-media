import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { encryptSocialToken, hashSocialOAuthState } from "@/lib/publishing/crypto";
import { futureIso, jsonProviderRequest } from "@/lib/publishing/provider-utils";
import { socialReturnUrl } from "@/lib/publishing/oauth";
import { consumeSocialOAuthState, upsertSocialConnection } from "@/lib/publishing/store";

export const runtime = "nodejs";

type TikTokToken = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code || url.searchParams.get("error")) return NextResponse.redirect(socialReturnUrl(url.origin, "tiktok_denied"));
  try {
    const record = await consumeSocialOAuthState(hashSocialOAuthState(state), "tiktok");
    const token = await jsonProviderRequest<TikTokToken>(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: getEnv("TIKTOK_CLIENT_KEY"),
          client_secret: getEnv("TIKTOK_CLIENT_SECRET"),
          code,
          grant_type: "authorization_code",
          redirect_uri: record.redirect_uri,
        }),
      },
      "TIKTOK_OAUTH",
    );
    const scopes = token.scope.split(",").map((item) => item.trim()).filter(Boolean);
    if (!scopes.includes("video.publish")) throw new Error("TIKTOK_VIDEO_PUBLISH_SCOPE_MISSING");
    const profile = await jsonProviderRequest<{
      data?: { user?: { open_id?: string; display_name?: string } };
      error?: { code?: string };
    }>(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
      "TIKTOK_PROFILE",
    );
    if (profile.error?.code && profile.error.code !== "ok") throw new Error(`TIKTOK_${profile.error.code}`);
    const access = encryptSocialToken(token.access_token);
    const refresh = encryptSocialToken(token.refresh_token);
    const displayName = profile.data?.user?.display_name?.trim() || "TikTok creator";
    await upsertSocialConnection({
      workspace_id: record.workspace_id,
      owner_scope: record.owner_scope,
      provider: "tiktok",
      provider_user_id: token.open_id,
      provider_account_id: token.open_id,
      provider_account_name: displayName,
      access_token_ciphertext: access.ciphertext,
      access_token_iv: access.iv,
      access_token_tag: access.tag,
      refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv,
      refresh_token_tag: refresh.tag,
      token_expires_at: futureIso(token.expires_in),
      refresh_token_expires_at: futureIso(token.refresh_expires_in),
      scopes,
      status: getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") === "true" ? "connected" : "test_mode",
      last_verified_at: null,
      last_error_code: null,
      last_error_message: null,
      metadata_json: { auditRequired: getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") !== "true" },
      disconnected_at: null,
      created_by: record.user_id,
    });
    return NextResponse.redirect(socialReturnUrl(url.origin, "tiktok_connected"));
  } catch (error) {
    console.error("TikTok OAuth callback failed", { code: error instanceof Error ? error.message.split(":")[0].slice(0, 100) : "UNKNOWN" });
    return NextResponse.redirect(socialReturnUrl(url.origin, "tiktok_failed"));
  }
}
