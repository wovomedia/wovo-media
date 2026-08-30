import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { resolveAdminTargetUser } from "@/lib/admin/target-user";
import {
  getAuthAdminUserById,
  supabaseServiceRoleRequest,
  updateAuthUserById,
} from "@/lib/supabase/server";
import { appendAdminActionLog, appendAdminNotification } from "@/lib/admin/audit-log";

type UpdateAdminRoleBody = {
  userId?: string;
  email?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser(request.headers.get("authorization"));

    let body: UpdateAdminRoleBody = {};
    try {
      body = (await request.json()) as UpdateAdminRoleBody;
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const normalizedRole = (body.role ?? "admin").trim().toLowerCase();
    if (normalizedRole !== "admin" && normalizedRole !== "user") {
      return NextResponse.json({ error: "Role must be either 'admin' or 'user'." }, { status: 400 });
    }

    const target = await resolveAdminTargetUser({
      userId: body.userId?.trim() ?? null,
      email: body.email?.trim() ?? null,
    });
    if (!target) {
      return NextResponse.json({ error: "Target account not found." }, { status: 404 });
    }

    const fallbackEmail = body.email?.trim().toLowerCase() ?? "";
    const targetEmail = target.email ?? (fallbackEmail || null);
    await supabaseServiceRoleRequest("/rest/v1/users?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: target.id,
        email: targetEmail ?? "",
        role: normalizedRole,
      }),
    }).catch(() => undefined);

    await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    const authTarget = await getAuthAdminUserById(target.id).catch(() => null);
    if (authTarget?.id) {
      const currentAppMetadata = (authTarget.app_metadata ?? {}) as Record<string, unknown>;
      await updateAuthUserById(authTarget.id, {
        app_metadata: {
          ...currentAppMetadata,
          role: normalizedRole,
        },
      });
    }

    await appendAdminActionLog({
      adminUserId: adminUser.id,
      action: normalizedRole === "admin" ? "grant_admin_role" : "revoke_admin_role",
      targetUserId: target.id,
      metadata: {
        role: normalizedRole,
        target_email: targetEmail,
      },
    });

    await appendAdminNotification({
      type: normalizedRole === "admin" ? "admin_role_granted" : "admin_role_revoked",
      payload: {
        target_user_id: target.id,
        target_email: targetEmail,
        role: normalizedRole,
      },
    });

    return NextResponse.json({
      ok: true,
      userId: target.id,
      email: targetEmail,
      role: normalizedRole,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update admin role." },
      { status: 500 },
    );
  }
}
