import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { hashSocialOAuthState } from "@/lib/publishing/crypto";
import { resolveSocialOAuthTarget, socialEncryptionConfigured, socialRedirectUrl } from "@/lib/publishing/oauth";
import { createSocialOAuthState } from "@/lib/publishing/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accountId?: string };
    const target = await resolveSocialOAuthTarget(request.headers.get("authorization"), body.accountId);
    const clientId = getEnv("GOOGLE_YOUTUBE_CLIENT_ID");
    if (!clientId || !getEnv("GOOGLE_YOUTUBE_CLIENT_SECRET") || !socialEncryptionConfigured()) {
      return NextResponse.json({ error: "YouTube connection is not configured for this deployment." }, { status: 503 });
    }
    const state = randomBytes(32).toString("hex");
    const redirectUri = socialRedirectUrl(new URL(request.url).origin, "youtube");
    await createSocialOAuthState({
      state_hash: hashSocialOAuthState(state),
      workspace_id: target.workspaceId,
      owner_scope: target.ownerScope,
      user_id: target.context.user.id,
      provider: "youtube",
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return NextResponse.json({ url: url.toString(), redirectUrl: redirectUri });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized." }, { status });
  }
}
