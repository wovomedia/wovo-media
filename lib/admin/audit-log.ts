import { randomUUID } from "node:crypto";
import {
  getAuthAdminUserById,
  listAuthAdminUsers,
  supabaseServiceRoleRequest,
  updateAuthUserById,
  type AuthUser,
} from "@/lib/supabase/server";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";

export type AdminActionEntry = {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminNotificationEntry = {
  id: string;
  type: string;
  created_at: string;
  payload: Record<string, unknown>;
  read?: boolean;
};

const ACTIONS_METADATA_KEY = "wovo_admin_actions";
const NOTIFICATIONS_METADATA_KEY = "wovo_admin_notifications";
const MAX_ACTION_LOGS = 300;
const MAX_NOTIFICATIONS = 300;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const id = row.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

function parseAdminActionRow(value: unknown): AdminActionEntry | null {
  const row = asRecord(value);
  const id = asString(row.id).trim();
  const action = asString(row.action).trim();
  const createdAt = asString(row.created_at).trim();
  if (!id || !action || !createdAt) return null;
  const adminUserIdRaw = asString(row.admin_user_id).trim();
  const targetUserIdRaw = asString(row.target_user_id).trim();
  return {
    id,
    admin_user_id: isUuid(adminUserIdRaw) ? adminUserIdRaw : null,
    action,
    target_user_id: isUuid(targetUserIdRaw) ? targetUserIdRaw : null,
    metadata: asRecord(row.metadata),
    created_at: createdAt,
  };
}

function parseNotificationRow(value: unknown): AdminNotificationEntry | null {
  const row = asRecord(value);
  const id = asString(row.id).trim();
  const type = asString(row.type).trim();
  const createdAt = asString(row.created_at).trim();
  if (!id || !type || !createdAt) return null;
  return {
    id,
    type,
    created_at: createdAt,
    payload: asRecord(row.payload),
    read: Boolean(row.read),
  };
}

function isMissingAdminActionsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("admin_actions") ||
    ((message.includes("relation") || message.includes("could not find the table")) &&
      message.includes("admin_actions"))
  );
}

function toActionList(user: AuthUser): AdminActionEntry[] {
  const metadata = asRecord(user.app_metadata);
  const list = Array.isArray(metadata[ACTIONS_METADATA_KEY]) ? metadata[ACTIONS_METADATA_KEY] : [];
  return uniqueById(
    list
      .map((item) => parseAdminActionRow(item))
      .filter((item): item is AdminActionEntry => Boolean(item)),
  );
}

function toNotificationList(user: AuthUser): AdminNotificationEntry[] {
  const metadata = asRecord(user.app_metadata);
  const list = Array.isArray(metadata[NOTIFICATIONS_METADATA_KEY]) ? metadata[NOTIFICATIONS_METADATA_KEY] : [];
  return uniqueById(
    list
      .map((item) => parseNotificationRow(item))
      .filter((item): item is AdminNotificationEntry => Boolean(item)),
  );
}

async function updateAdminMetadataLists(
  userId: string,
  updater: (current: {
    appMetadata: Record<string, unknown>;
    actions: AdminActionEntry[];
    notifications: AdminNotificationEntry[];
  }) => { actions?: AdminActionEntry[]; notifications?: AdminNotificationEntry[] },
): Promise<void> {
  const authUser = await getAuthAdminUserById(userId);
  if (!authUser) return;
  const currentAppMetadata = asRecord(authUser.app_metadata);
  const currentActions = toActionList(authUser);
  const currentNotifications = toNotificationList(authUser);
  const next = updater({
    appMetadata: currentAppMetadata,
    actions: currentActions,
    notifications: currentNotifications,
  });

  const nextAppMetadata: Record<string, unknown> = {
    ...currentAppMetadata,
    [ACTIONS_METADATA_KEY]: (next.actions ?? currentActions).slice(0, MAX_ACTION_LOGS),
    [NOTIFICATIONS_METADATA_KEY]: (next.notifications ?? currentNotifications).slice(0, MAX_NOTIFICATIONS),
  };

  await updateAuthUserById(userId, {
    app_metadata: nextAppMetadata,
  });
}

function isAdminAuthUser(user: AuthUser): boolean {
  const email = (user.email ?? "").trim().toLowerCase();
  const appRole = asString(asRecord(user.app_metadata).role).trim().toLowerCase();
  const userRole = asString(asRecord(user.user_metadata).role).trim().toLowerCase();
  return appRole === "admin" || userRole === "admin" || isAdminProEmail(email);
}

export async function resolveAdminRecipientIds(): Promise<string[]> {
  try {
    const adminRows = await supabaseServiceRoleRequest<Array<{ id: string }>>(
      "/rest/v1/users?select=id&role=eq.admin&limit=400",
    );
    const ids = (adminRows ?? []).map((row) => row.id).filter((id) => isUuid(id));
    if (ids.length > 0) return Array.from(new Set(ids));
  } catch {
    // fallback below
  }

  const authUsers = await listAuthAdminUsers({ page: 1, perPage: 500 }).catch(() => []);
  return Array.from(
    new Set(
      authUsers
        .filter((user) => user?.id && isAdminAuthUser(user))
        .map((user) => user.id),
    ),
  );
}

export async function appendAdminActionLog(input: {
  adminUserId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ usedFallback: boolean; entry: AdminActionEntry }> {
  const entry: AdminActionEntry = {
    id: randomUUID(),
    admin_user_id: input.adminUserId,
    action: input.action,
    target_user_id: input.targetUserId && isUuid(input.targetUserId) ? input.targetUserId : null,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  try {
    const rows = await supabaseServiceRoleRequest<AdminActionEntry[]>("/rest/v1/admin_actions?select=id,admin_user_id,action,target_user_id,metadata,created_at", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        admin_user_id: entry.admin_user_id,
        action: entry.action,
        target_user_id: entry.target_user_id,
        metadata: entry.metadata,
      }),
    });
    return {
      usedFallback: false,
      entry: rows?.[0] ?? entry,
    };
  } catch (error) {
    if (!isMissingAdminActionsTableError(error)) {
      throw error;
    }
  }

  await updateAdminMetadataLists(input.adminUserId, ({ actions }) => {
    const nextActions = [entry, ...actions.filter((item) => item.id !== entry.id)].slice(0, MAX_ACTION_LOGS);
    return { actions: nextActions };
  });

  return { usedFallback: true, entry };
}

export async function appendAdminNotification(input: {
  type: string;
  payload: Record<string, unknown>;
  notifyAdminUserIds?: string[];
}): Promise<void> {
  const notification: AdminNotificationEntry = {
    id: randomUUID(),
    type: input.type,
    created_at: new Date().toISOString(),
    payload: input.payload,
    read: false,
  };

  const adminUserIds = Array.from(new Set((input.notifyAdminUserIds ?? []).filter((id) => isUuid(id))));
  const recipients = adminUserIds.length > 0 ? adminUserIds : await resolveAdminRecipientIds();
  await Promise.all(
    recipients.map(async (userId) => {
      await updateAdminMetadataLists(userId, ({ notifications }) => ({
        notifications: [notification, ...notifications.filter((item) => item.id !== notification.id)].slice(0, MAX_NOTIFICATIONS),
      }));
    }),
  );
}

export async function listAdminActions(limit = 100): Promise<AdminActionEntry[]> {
  try {
    const rows = await supabaseServiceRoleRequest<AdminActionEntry[]>(
      `/rest/v1/admin_actions?select=id,admin_user_id,action,target_user_id,metadata,created_at&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 500))}`,
    );
    return rows ?? [];
  } catch (error) {
    if (!isMissingAdminActionsTableError(error)) {
      throw error;
    }
  }

  const adminUsers = await listAuthAdminUsers({ page: 1, perPage: 500 }).catch(() => []);
  const actions = adminUsers
    .filter((user) => user?.id && isAdminAuthUser(user))
    .flatMap((user) => toActionList(user));
  return actions
    .sort((a, b) => {
      const at = Date.parse(a.created_at);
      const bt = Date.parse(b.created_at);
      return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
    })
    .slice(0, Math.max(1, Math.min(limit, 500)));
}

export async function listAdminNotifications(limit = 100): Promise<AdminNotificationEntry[]> {
  const adminUsers = await listAuthAdminUsers({ page: 1, perPage: 500 }).catch(() => []);
  const notifications = adminUsers
    .filter((user) => user?.id && isAdminAuthUser(user))
    .flatMap((user) => toNotificationList(user));
  return notifications
    .sort((a, b) => {
      const at = Date.parse(a.created_at);
      const bt = Date.parse(b.created_at);
      return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
    })
    .slice(0, Math.max(1, Math.min(limit, 500)));
}

