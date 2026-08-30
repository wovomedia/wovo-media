import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { resolveAdminTargetUser } from "@/lib/admin/target-user";
import { getAuthAdminUserById, supabaseServiceRoleRequest, updateAuthUserById } from "@/lib/supabase/server";
import { isMissingVerifiedSubscriptionsTableError } from "@/lib/wovo-ai/badges";
import { appendAdminActionLog, appendAdminNotification } from "@/lib/admin/audit-log";

type UpdateVerifiedBody = {
  userId?: string;
  email?: string;
  verified?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser(request.headers.get("authorization"));

    let body: UpdateVerifiedBody = {};
    try {
      body = (await request.json()) as UpdateVerifiedBody;
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const target = await resolveAdminTargetUser({
      userId: body.userId?.trim() ?? null,
      email: body.email?.trim() ?? null,
    });
    if (!target) {
      return NextResponse.json({ error: "Target account not found." }, { status: 404 });
    }

    const shouldVerify = body.verified !== false;
    const nowIso = new Date().toISOString();
    let usedFallback = false;

    try {
      await supabaseServiceRoleRequest("/rest/v1/verified_subscriptions?on_conflict=user_id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: target.id,
          status: shouldVerify ? "active" : "inactive",
          badge_active: shouldVerify,
          cancel_at_period_end: false,
          updated_at: nowIso,
        }),
      });
    } catch (error) {
      if (isMissingVerifiedSubscriptionsTableError(error)) {
        usedFallback = true;
      } else {
        throw error;
      }
    }

    const authTarget = await getAuthAdminUserById(target.id).catch(() => null);
    if (authTarget?.id) {
      const currentAppMetadata = asRecord(authTarget.app_metadata);
      const badgePayload = {
        wovo_verified_badge_override: shouldVerify,
        wovo_verified_badge_override_updated_at: nowIso,
        wovo_verified_badge_override_by_admin: adminUser.id,
      };
      await updateAuthUserById(authTarget.id, {
        app_metadata: {
          ...currentAppMetadata,
          ...badgePayload,
        },
      }).catch(() => undefined);
    }

    await appendAdminActionLog({
      adminUserId: adminUser.id,
      action: shouldVerify ? "grant_verified_badge" : "revoke_verified_badge",
      targetUserId: target.id,
      metadata: {
        verified: shouldVerify,
        target_email: target.email ?? null,
      },
    });

    await appendAdminNotification({
      type: shouldVerify ? "verified_badge_granted" : "verified_badge_revoked",
      payload: {
        target_user_id: target.id,
        target_email: target.email ?? null,
        verified: shouldVerify,
      },
    });

    return NextResponse.json({
      ok: true,
      userId: target.id,
      email: target.email ?? null,
      verified: shouldVerify,
      usedFallback,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update verified badge." },
      { status: 500 },
    );
  }
}
