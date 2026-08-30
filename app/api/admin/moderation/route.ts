import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { resolveAdminTargetUser } from "@/lib/admin/target-user";
import { appendAdminActionLog, appendAdminNotification } from "@/lib/admin/audit-log";
import { getAuthAdminUserById, updateAuthUserById } from "@/lib/supabase/server";
import { getModerationStateForUser } from "@/lib/wovo-ai/moderation";

type ModerationActionType = "ban" | "unban" | "disable_feed" | "enable_feed";

type ModerationBody = {
  userId?: string;
  email?: string;
  action?: ModerationActionType;
  reason?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toAdminAction(action: ModerationActionType): string {
  if (action === "ban") return "ban_account";
  if (action === "unban") return "unban_account";
  if (action === "disable_feed") return "disable_feed_posting";
  return "enable_feed_posting";
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser(request.headers.get("authorization"));

    let body: ModerationBody = {};
    try {
      body = (await request.json()) as ModerationBody;
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const action = body.action;
    if (!action || !["ban", "unban", "disable_feed", "enable_feed"].includes(action)) {
      return NextResponse.json({ error: "A valid moderation action is required." }, { status: 400 });
    }

    const target = await resolveAdminTargetUser({
      userId: body.userId?.trim() ?? null,
      email: body.email?.trim() ?? null,
    });
    if (!target) {
      return NextResponse.json({ error: "Target account not found." }, { status: 404 });
    }

    const reason = (body.reason ?? "").trim() || null;
    const authTarget = await getAuthAdminUserById(target.id).catch(() => null);
    if (authTarget?.id) {
      const currentAppMetadata = asRecord(authTarget.app_metadata);
      const currentBanned = Boolean(
        currentAppMetadata.wovo_moderation_banned ?? false,
      );
      const currentFeedDisabled = Boolean(
        currentAppMetadata.wovo_feed_posting_disabled ?? false,
      );

      let nextBanned = currentBanned;
      let nextFeedDisabled = currentFeedDisabled;
      if (action === "ban") {
        nextBanned = true;
        nextFeedDisabled = true;
      } else if (action === "unban") {
        nextBanned = false;
        nextFeedDisabled = false;
      } else if (action === "disable_feed") {
        nextFeedDisabled = true;
      } else if (action === "enable_feed") {
        nextFeedDisabled = false;
      }

      const moderationPayload = {
        wovo_moderation_banned: nextBanned,
        wovo_feed_posting_disabled: nextFeedDisabled,
        wovo_moderation_reason: reason,
        wovo_moderation_updated_at: new Date().toISOString(),
      };

      await updateAuthUserById(authTarget.id, {
        app_metadata: {
          ...currentAppMetadata,
          ...moderationPayload,
        },
      }).catch(() => undefined);
    }

    await appendAdminActionLog({
      adminUserId: adminUser.id,
      action: toAdminAction(action),
      targetUserId: target.id,
      metadata: {
        reason,
        target_email: target.email ?? null,
      },
    });

    if (action === "ban") {
      await appendAdminNotification({
        type: "user_banned",
        payload: {
          target_user_id: target.id,
          target_email: target.email ?? null,
          reason,
          appeal_email: "support@wovomedia.com",
        },
      });
    }

    const moderationState = await getModerationStateForUser(target.id);

    return NextResponse.json({
      ok: true,
      userId: target.id,
      email: target.email ?? null,
      action,
      moderation: moderationState,
      notice:
        action === "ban"
          ? "Account banned. User must contact support@wovomedia.com to appeal."
          : undefined,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update moderation state." },
      { status: 500 },
    );
  }
}
