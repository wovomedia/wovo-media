import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { encryptMetaToken, hashMetaState, META_API_VERSION, metaGraph, metaRedirectUrl } from "@/lib/meta/integration";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type StateRow = { state_hash: string; account_id: string | null; owner_scope: boolean; user_id: string; expires_at: string; used_at: string | null };
type PageRow = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = (getEnv("NEXT_PUBLIC_SITE_URL") || requestUrl.origin).replace(/\/$/, "");
  const state = requestUrl.searchParams.get("state") ?? "";
  const code = requestUrl.searchParams.get("code") ?? "";
  if (!state || !code) return NextResponse.redirect(`${siteUrl}/portal?meta=denied`);
  try {
    const rows = await supabaseServiceRoleRequest<StateRow[]>(`/rest/v1/wovo_meta_oauth_states?select=*&state_hash=eq.${hashMetaState(state)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`).catch(() => []);
    const record = rows?.[0];
    if (!record) throw new Error("META_STATE_INVALID");
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_oauth_states?state_hash=eq.${record.state_hash}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ used_at: new Date().toISOString() }) });
    const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", getEnv("META_APP_ID"));
    tokenUrl.searchParams.set("client_secret", getEnv("META_APP_SECRET"));
    tokenUrl.searchParams.set("redirect_uri", metaRedirectUrl(siteUrl));
    tokenUrl.searchParams.set("code", code);
    const token = await metaGraph<{ access_token: string; expires_in?: number }>(tokenUrl.toString(), "");
    const permissions = await metaGraph<{ data?: Array<{ permission: string; status: string }> }>(`me/permissions?access_token=${encodeURIComponent(token.access_token)}`, token.access_token);
    const grantedScopes = permissions.data?.filter((item) => item.status === "granted").map((item) => item.permission) ?? [];
    const pages = await metaGraph<{ data: PageRow[] }>(`me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token.access_token)}`, token.access_token);
    if (!pages.data?.length) throw new Error("META_NO_MANAGED_PAGE");
    const page = pages.data.find((item) => item.instagram_business_account) ?? pages.data[0];
    const encrypted = encryptMetaToken(page.access_token);
    await supabaseServiceRoleRequest("/rest/v1/wovo_meta_connections?on_conflict=account_id,owner_scope", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ account_id: record.account_id, owner_scope: record.owner_scope, connected_by: record.user_id, app_id: getEnv("META_APP_ID"), status: "healthy", action_policy: "approve_each", page_id: page.id, page_name: page.name, instagram_user_id: page.instagram_business_account?.id ?? null, instagram_username: page.instagram_business_account?.username ?? null, granted_scopes: grantedScopes, token_ciphertext: encrypted.ciphertext, token_iv: encrypted.iv, token_tag: encrypted.tag, token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null, kill_switch: true, last_checked_at: new Date().toISOString(), revoked_at: null, updated_at: new Date().toISOString() }) });
    return NextResponse.redirect(`${siteUrl}/portal?meta=connected`);
  } catch (error) {
    console.error("Meta OAuth callback failed", { message: error instanceof Error ? error.message.slice(0, 160) : "Unknown" });
    return NextResponse.redirect(`${siteUrl}/portal?meta=failed`);
  }
}
