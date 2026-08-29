import { NextResponse } from "next/server";
import { metaPublishingScaffoldStatus, metaRedirectUrl } from "@/lib/meta/integration";
import { loadMetaConnections } from "@/lib/meta/publishing";
import { assertPortalAccountAccess, isUuid, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const accountId = new URL(request.url).searchParams.get("accountId") || undefined;
    const ownerScope = !accountId && context.mode === "staff" && context.staffRole === "owner";
    if (!ownerScope && !isUuid(accountId)) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
    if (!ownerScope) await assertPortalAccountAccess(context, accountId!);
    const connections = await loadMetaConnections({ accountId, ownerScope });
    const connection = connections[0] ?? null;
    const runtime = metaPublishingScaffoldStatus();
    const deliveries = !ownerScope && accountId ? await supabaseServiceRoleRequest<Array<Record<string, unknown>>>(
      `/rest/v1/wovo_meta_publish_jobs?select=id,source_content_item_id,destination,status,scheduled_for,provider_post_id,published_at,last_error_summary,created_at&account_id=eq.${encodeURIComponent(accountId)}&owner_scope=eq.false&source_content_item_id=not.is.null&order=created_at.desc&limit=100`,
    ).catch(() => []) : [];
    return NextResponse.json({
      runtime: { ...runtime, redirectUrl: metaRedirectUrl(new URL(request.url).origin) },
      connection: connection ? { id: connection.id, status: connection.status, actionPolicy: connection.action_policy, pageName: connection.page_name, instagramUsername: connection.instagram_username, killSwitch: connection.kill_switch, lastCheckedAt: connection.last_checked_at, lastActionAt: connection.last_action_at, tokenExpiresAt: connection.token_expires_at, lastErrorCode: connection.last_error_code, grantedScopes: connection.granted_scopes, e2eVerifiedAt: connection.e2e_verified_at, autoPublishOptedInAt: connection.auto_publish_opted_in_at } : null,
      connections: connections.map((item) => ({ id: item.id, status: item.status, actionPolicy: item.action_policy, pageName: item.page_name, instagramUsername: item.instagram_username, killSwitch: item.kill_switch })),
      deliveries,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
}
