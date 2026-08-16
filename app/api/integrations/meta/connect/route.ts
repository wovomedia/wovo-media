import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { hashMetaState, META_FACEBOOK_LOGIN_PERMISSIONS, metaPublishingScaffoldStatus, metaRedirectUrl } from "@/lib/meta/integration";
import { assertPortalAccountAccess, isUuid, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as { accountId?: string };
    const ownerScope = !body.accountId && context.mode === "staff" && context.staffRole === "owner";
    if (!ownerScope && !isUuid(body.accountId)) return NextResponse.json({ error: "A valid client workspace is required." }, { status: 400 });
    if (!ownerScope) await assertPortalAccountAccess(context, body.accountId!);
    const status = metaPublishingScaffoldStatus();
    if (status.launchState !== "connection_ready") return NextResponse.json({ error: "Official Meta connection is not configured for this deployment.", state: status.launchState }, { status: 503 });
    const state = randomBytes(32).toString("hex");
    await supabaseServiceRoleRequest("/rest/v1/wovo_meta_oauth_states", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ state_hash: hashMetaState(state), account_id: ownerScope ? null : body.accountId, owner_scope: ownerScope, user_id: context.user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }) });
    const redirectUri = metaRedirectUrl(new URL(request.url).origin);
    const url = new URL("https://www.facebook.com/v24.0/dialog/oauth");
    url.searchParams.set("client_id", getEnv("META_APP_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", META_FACEBOOK_LOGIN_PERMISSIONS.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("config_id", getEnv("META_LOGIN_CONFIG_ID"));
    return NextResponse.json({ url: url.toString(), redirectUrl: redirectUri });
  } catch { return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
}
