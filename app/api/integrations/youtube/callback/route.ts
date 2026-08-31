import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { encryptSocialToken, hashSocialOAuthState } from "@/lib/publishing/crypto";
import { futureIso, jsonProviderRequest } from "@/lib/publishing/provider-utils";
import { socialReturnUrl } from "@/lib/publishing/oauth";
import { consumeSocialOAuthState, upsertSocialConnection } from "@/lib/publishing/store";

export const runtime = "nodejs";

type GoogleToken = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; token_type: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code || url.searchParams.get("error")) return NextResponse.redirect(socialReturnUrl(url.origin, "youtube_denied"));
  try {
    const record = await consumeSocialOAuthState(hashSocialOAuthState(state), "youtube");
    const token = await jsonProviderRequest<GoogleToken>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: getEnv("GOOGLE_YOUTUBE_CLIENT_ID"),
          client_secret: getEnv("GOOGLE_YOUTUBE_CLIENT_SECRET"),
          code,
          grant_type: "authorization_code",
          redirect_uri: record.redirect_uri,
        }),
      },
      "YOUTUBE_OAUTH",
    );
    if (!token.refresh_token) throw new Error("YOUTUBE_OFFLINE_REFRESH_TOKEN_MISSING");
    const scopes = (token.scope ?? "").split(" ").filter(Boolean);
    if (!scopes.includes("https://www.googleapis.com/auth/youtube.upload")) throw new Error("YOUTUBE_UPLOAD_SCOPE_MISSING");
    const channels = await jsonProviderRequest<{
      items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string } }>;
    }>(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
      "YOUTUBE_CHANNEL",
    );
    const channel = channels.items?.[0];
    if (!channel?.id) throw new Error("YOUTUBE_CHANNEL_NOT_FOUND");
    const access = encryptSocialToken(token.access_token);
    const refresh = encryptSocialToken(token.refresh_token);
    await upsertSocialConnection({
      workspace_id: record.workspace_id,
      owner_scope: record.owner_scope,
      provider: "youtube",
      provider_user_id: channel.id,
      provider_account_id: channel.id,
      provider_account_name: channel.snippet?.title?.trim() || "YouTube channel",
      access_token_ciphertext: access.ciphertext,
      access_token_iv: access.iv,
      access_token_tag: access.tag,
      refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv,
      refresh_token_tag: refresh.tag,
      token_expires_at: futureIso(token.expires_in),
      refresh_token_expires_at: null,
      scopes,
      status: getEnv("WOVO_YOUTUBE_API_AUDITED") === "true" ? "connected" : "test_mode",
      last_verified_at: null,
      last_error_code: null,
      last_error_message: null,
      metadata_json: { customUrl: channel.snippet?.customUrl ?? null, apiAuditRequired: getEnv("WOVO_YOUTUBE_API_AUDITED") !== "true" },
      disconnected_at: null,
      created_by: record.user_id,
    });
    return NextResponse.redirect(socialReturnUrl(url.origin, "youtube_connected"));
  } catch (error) {
    console.error("YouTube OAuth callback failed", { code: error instanceof Error ? error.message.split(":")[0].slice(0, 100) : "UNKNOWN" });
    return NextResponse.redirect(socialReturnUrl(url.origin, "youtube_failed"));
  }
}
