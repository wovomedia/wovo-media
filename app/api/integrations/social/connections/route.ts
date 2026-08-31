import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { decryptSocialToken } from "@/lib/publishing/crypto";
import { resolveSocialOAuthTarget, socialEncryptionConfigured, socialRedirectUrl } from "@/lib/publishing/oauth";
import { verifyAndPersistSocialConnection } from "@/lib/publishing/service";
import { listSocialConnections, loadSocialConnection, updateSocialConnection } from "@/lib/publishing/store";
import type { SocialConnectionRecord } from "@/lib/publishing/types";
import { loadMetaConnections } from "@/lib/meta/publishing";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

function publicConnection(connection: SocialConnectionRecord) {
  return {
    id: connection.id,
    provider: connection.provider,
    accountId: connection.provider_account_id,
    accountName: connection.provider_account_name,
    status: connection.status,
    scopes: connection.scopes,
    tokenExpiresAt: connection.token_expires_at,
    lastVerifiedAt: connection.last_verified_at,
    lastErrorCode: connection.last_error_code,
    lastErrorMessage: connection.last_error_message,
    metadata: connection.metadata_json,
  };
}

function connectionRuntime(origin: string) {
  return {
    facebook: {
      configured: Boolean(getEnv("META_APP_ID") && getEnv("META_APP_SECRET") && getEnv("META_TOKEN_ENCRYPTION_KEY")),
      enabled: getEnv("WOVO_META_PUBLISHING_ENABLED") === "true",
      callbackUrl: `${(getEnv("NEXT_PUBLIC_SITE_URL") || origin).replace(/\/$/, "")}/api/integrations/meta/callback`,
    },
    instagram: {
      configured: Boolean(getEnv("META_APP_ID") && getEnv("META_APP_SECRET") && getEnv("META_TOKEN_ENCRYPTION_KEY")),
      enabled: getEnv("WOVO_META_PUBLISHING_ENABLED") === "true",
      callbackUrl: `${(getEnv("NEXT_PUBLIC_SITE_URL") || origin).replace(/\/$/, "")}/api/integrations/meta/callback`,
    },
    tiktok: {
      configured: Boolean(getEnv("TIKTOK_CLIENT_KEY") && getEnv("TIKTOK_CLIENT_SECRET") && socialEncryptionConfigured()),
      enabled: getEnv("WOVO_TIKTOK_DIRECT_POST_ENABLED") === "true",
      audited: getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") === "true",
      callbackUrl: socialRedirectUrl(origin, "tiktok"),
    },
    youtube: {
      configured: Boolean(getEnv("GOOGLE_YOUTUBE_CLIENT_ID") && getEnv("GOOGLE_YOUTUBE_CLIENT_SECRET") && socialEncryptionConfigured()),
      enabled: getEnv("WOVO_YOUTUBE_PUBLISHING_ENABLED") === "true",
      oauthVerified: getEnv("WOVO_YOUTUBE_OAUTH_VERIFIED") === "true",
      audited: getEnv("WOVO_YOUTUBE_API_AUDITED") === "true",
      callbackUrl: socialRedirectUrl(origin, "youtube"),
    },
  };
}

async function fallbackMetaConnections(workspaceId: string | null, ownerScope: boolean) {
  const rows = await loadMetaConnections({ accountId: workspaceId ?? undefined, ownerScope });
  return rows.flatMap((item) => [
    {
      id: `legacy-facebook:${item.id}`,
      provider: "facebook" as const,
      accountId: item.page_id,
      accountName: item.page_name,
      status: item.status === "healthy" ? (item.e2e_verified_at ? "publishing_ready" : "connected") : item.status,
      scopes: item.granted_scopes,
      tokenExpiresAt: item.token_expires_at,
      lastVerifiedAt: item.last_checked_at,
      lastErrorCode: item.last_error_code,
      lastErrorMessage: null,
      metadata: { legacyMetaConnectionId: item.id, actionPolicy: item.action_policy, killSwitch: item.kill_switch },
    },
    ...(item.instagram_user_id ? [{
      id: `legacy-instagram:${item.id}`,
      provider: "instagram" as const,
      accountId: item.instagram_user_id,
      accountName: item.instagram_username ? `@${item.instagram_username}` : item.page_name,
      status: item.status === "healthy" ? (item.e2e_verified_at ? "publishing_ready" : "connected") : item.status,
      scopes: item.granted_scopes,
      tokenExpiresAt: item.token_expires_at,
      lastVerifiedAt: item.last_checked_at,
      lastErrorCode: item.last_error_code,
      lastErrorMessage: null,
      metadata: { legacyMetaConnectionId: item.id, facebookPageName: item.page_name, actionPolicy: item.action_policy, killSwitch: item.kill_switch },
    }] : []),
  ]);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId") || undefined;
    const target = await resolveSocialOAuthTarget(request.headers.get("authorization"), accountId);
    const generic = await listSocialConnections({ workspaceId: target.workspaceId ?? undefined, ownerScope: target.ownerScope }).catch(() => []);
    const mapped = generic.map(publicConnection);
    const providers = new Set(mapped.map((item) => item.provider));
    const legacy = await fallbackMetaConnections(target.workspaceId, target.ownerScope).catch(() => []);
    const connections = [...mapped, ...legacy.filter((item) => !providers.has(item.provider))];
    return NextResponse.json({ runtime: connectionRuntime(url.origin), connections }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 401;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized." }, { status });
  }
}

async function revokeProvider(connection: SocialConnectionRecord) {
  if (connection.provider === "tiktok") {
    const token = decryptSocialToken({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    });
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: getEnv("TIKTOK_CLIENT_KEY"), client_secret: getEnv("TIKTOK_CLIENT_SECRET"), token }),
      cache: "no-store",
    }).catch(() => null);
  } else if (connection.provider === "youtube") {
    const token = decryptSocialToken({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    });
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    }).catch(() => null);
  } else {
    const legacyId = typeof connection.metadata_json?.legacy_meta_connection_id === "string" ? connection.metadata_json.legacy_meta_connection_id : "";
    if (legacyId) await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?id=eq.${encodeURIComponent(legacyId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "revoked", kill_switch: true, token_ciphertext: "revoked", token_iv: "revoked", token_tag: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    }).catch(() => null);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accountId?: string; action?: string; connectionId?: string };
    const target = await resolveSocialOAuthTarget(request.headers.get("authorization"), body.accountId);
    const allowed = await listSocialConnections({ workspaceId: target.workspaceId ?? undefined, ownerScope: target.ownerScope });
    const connection = allowed.find((item) => item.id === body.connectionId);
    if (!connection) return NextResponse.json({ error: "Connection not found in this workspace." }, { status: 404 });
    if (body.action === "verify") {
      const result = await verifyAndPersistSocialConnection(connection.id);
      return NextResponse.json({ connection: publicConnection(result.connection), verification: result.verification });
    }
    if (body.action === "disconnect") {
      const live = await loadSocialConnection(connection.id);
      if (!live) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
      await revokeProvider(live);
      const disconnected = await updateSocialConnection(live.id, {
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
      });
      return NextResponse.json({ connection: publicConnection(disconnected) });
    }
    return NextResponse.json({ error: "Unsupported connection action." }, { status: 400 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connection action failed." }, { status });
  }
}
