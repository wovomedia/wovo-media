import { listAdminActions } from "@/lib/admin/audit-log";
import { listAuthAdminUsers, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";
import { isPaidStatus } from "@/lib/wovo-ai/plans";

export type BadgeKind = "none" | "verified" | "gold";

type VerifiedSubscriptionRow = {
  user_id: string;
  status: string | null;
  badge_active: boolean | null;
  cancel_at_period_end: boolean | null;
};

type UserRoleRow = {
  id: string;
  role: string | null;
  email: string | null;
};

type AuthUserLite = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export function isMissingVerifiedSubscriptionsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("could not find the table") && message.includes("verified_subscriptions")) ||
    (message.includes("relation") && message.includes("verified_subscriptions") && message.includes("does not exist")) ||
    (message.includes("permission denied") && message.includes("verified_subscriptions"))
  );
}

function encodeUuidInClause(userIds: string[]): string {
  return encodeURIComponent(`(${userIds.join(",")})`);
}

function dedupeUserIds(userIds: string[]): string[] {
  const unique = new Set<string>();
  for (const userId of userIds) {
    const normalized = userId.trim();
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readBooleanFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

async function loadAuthUsersMap(userIds: string[]): Promise<Map<string, AuthUserLite>> {
  const ids = dedupeUserIds(userIds);
  const map = new Map<string, AuthUserLite>();
  if (ids.length === 0) return map;

  const idSet = new Set(ids);
  const authUsers = await listAuthAdminUsers({ page: 1, perPage: 1000 }).catch(() => []);
  for (const user of authUsers) {
    if (!user?.id || !idSet.has(user.id)) continue;
    map.set(user.id, {
      id: user.id,
      email: user.email,
      app_metadata: asRecord(user.app_metadata),
      user_metadata: asRecord(user.user_metadata),
    });
  }
  return map;
}

async function loadAdminUsers(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set<string>();

  const encodedUserIn = encodeUuidInClause(userIds);
  const rows = await supabaseServiceRoleRequest<UserRoleRow[]>(
    `/rest/v1/users?select=id,role,email&id=in.${encodedUserIn}`,
  ).catch(() => []);

  const adminUsers = new Set<string>();
  for (const row of rows ?? []) {
    const role = (row.role ?? "").trim().toLowerCase();
    if (role === "admin" || isAdminProEmail(row.email)) {
      adminUsers.add(row.id);
    }
  }

  const authUsers = await loadAuthUsersMap(userIds);
  for (const authUser of authUsers.values()) {
    const appRole = asString(asRecord(authUser.app_metadata).role).trim().toLowerCase();
    const userRole = asString(asRecord(authUser.user_metadata).role).trim().toLowerCase();
    if (appRole === "admin" || userRole === "admin" || isAdminProEmail(authUser.email)) {
      adminUsers.add(authUser.id);
    }
  }

  if (adminUsers.size === 0) {
    const profileRows = await supabaseServiceRoleRequest<Array<{ user_id: string; email: string | null }>>(
      `/rest/v1/profiles?select=user_id,email&user_id=in.${encodedUserIn}`,
    ).catch(() => []);
    for (const row of profileRows ?? []) {
      if (row?.user_id && isAdminProEmail(row.email)) {
        adminUsers.add(row.user_id);
      }
    }
  }

  return adminUsers;
}

async function loadVerifiedSubscriptionUsers(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set<string>();

  const encodedUserIn = encodeUuidInClause(userIds);
  try {
    const rows = await supabaseServiceRoleRequest<VerifiedSubscriptionRow[]>(
      `/rest/v1/verified_subscriptions?select=user_id,status,badge_active,cancel_at_period_end&user_id=in.${encodedUserIn}`,
    );
    const verifiedUsers = new Set<string>();
    for (const row of rows ?? []) {
      if (!row?.user_id) continue;
      const active = Boolean(row.badge_active) || (isPaidStatus(row.status) && !Boolean(row.cancel_at_period_end));
      if (active) verifiedUsers.add(row.user_id);
    }
    return verifiedUsers;
  } catch (error) {
    if (isMissingVerifiedSubscriptionsTableError(error)) {
      return new Set<string>();
    }
    throw error;
  }
}

async function loadManualBadgeOverrides(userIds: string[]): Promise<Map<string, boolean>> {
  const ids = dedupeUserIds(userIds);
  const overrides = new Map<string, boolean>();
  if (ids.length === 0) return overrides;

  const idSet = new Set(ids);
  const rows = await listAdminActions(Math.max(150, ids.length * 20)).catch(() => []);
  for (const row of rows ?? []) {
    const targetUserId = row.target_user_id?.trim();
    if (!targetUserId || !idSet.has(targetUserId) || overrides.has(targetUserId)) continue;
    if (row.action === "grant_verified_badge") {
      overrides.set(targetUserId, true);
      continue;
    }
    if (row.action === "revoke_verified_badge") {
      overrides.set(targetUserId, false);
    }
  }

  const authUsers = await loadAuthUsersMap(ids);
  for (const authUser of authUsers.values()) {
    if (overrides.has(authUser.id)) continue;
    const appMetadata = asRecord(authUser.app_metadata);
    const userMetadata = asRecord(authUser.user_metadata);
    const metadataOverride =
      readBooleanFlag(appMetadata.wovo_verified_badge_override) ??
      readBooleanFlag(userMetadata.wovo_verified_badge_override);
    if (metadataOverride === null) continue;
    overrides.set(authUser.id, metadataOverride);
  }

  return overrides;
}

export async function resolveBadgeMapForUsers(userIds: string[]): Promise<Map<string, BadgeKind>> {
  const ids = dedupeUserIds(userIds);
  const badgeMap = new Map<string, BadgeKind>();
  if (ids.length === 0) return badgeMap;

  const [adminUsers, verifiedUsers, manualOverrides] = await Promise.all([
    loadAdminUsers(ids),
    loadVerifiedSubscriptionUsers(ids),
    loadManualBadgeOverrides(ids),
  ]);

  for (const userId of ids) {
    if (adminUsers.has(userId)) {
      badgeMap.set(userId, "gold");
      continue;
    }

    if (manualOverrides.has(userId)) {
      badgeMap.set(userId, manualOverrides.get(userId) ? "verified" : "none");
      continue;
    }

    badgeMap.set(userId, verifiedUsers.has(userId) ? "verified" : "none");
  }

  return badgeMap;
}

export async function resolveBadgeForUser(userId: string): Promise<BadgeKind> {
  const map = await resolveBadgeMapForUsers([userId]);
  return map.get(userId) ?? "none";
}

