import { NextResponse } from "next/server";
import { assertPortalAccountAccess, isUuid, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as { accountId?: string };
    const ownerScope = !body.accountId && context.mode === "staff" && context.staffRole === "owner";
    if (!ownerScope && !isUuid(body.accountId)) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
    if (!ownerScope) await assertPortalAccountAccess(context, body.accountId!);
    const filter = ownerScope ? "owner_scope=eq.true&account_id=is.null" : `owner_scope=eq.false&account_id=eq.${encodeURIComponent(body.accountId!)}`;
    await supabaseServiceRoleRequest(`/rest/v1/wovo_meta_connections?${filter}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "revoked", kill_switch: true, token_ciphertext: "revoked", token_iv: "revoked", token_tag: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    return NextResponse.json({ revoked: true });
  } catch { return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
}
