import { listAdminActions } from "@/lib/admin/audit-log";
import { listAuthAdminUsers } from "@/lib/supabase/server";

export type ModerationState = {
  banned: boolean;
  feedPostingDisabled: boolean;
};

type ModerationActionRow = {
  target_user_id: string | null;
  action: string;
  created_at: string;
};

const MODERATION_ACTIONS = [
  "ban_account",
  "unban_account",
  "disable_feed_posting",
  "enable_feed_posting",
] as const;

const DEFAULT_STATE: ModerationState = {
  banned: false,
  feedPostingDisabled: false,
};

function normalizeUserIds(userIds: string[]): string[] {
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

async function loadModerationActions(userIds: string[]): Promise<ModerationActionRow[]> {
  if (userIds.length === 0) return [];
  const userIdSet = new Set(userIds);
  const actions = await listAdminActions(Math.max(200, userIds.length * 20)).catch(() => []);
  return (actions ?? [])
    .filter((row) => row?.target_user_id && userIdSet.has(row.target_user_id) && MODERATION_ACTIONS.includes(row.action as (typeof MODERATION_ACTIONS)[number]))
    .map((row) => ({
      target_user_id: row.target_user_id,
      action: row.action,
      created_at: row.created_at,
    }))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

async function loadMetadataModerationMap(userIds: string[]): Promise<Map<string, ModerationState>> {
  const result = new Map<string, ModerationState>();
  if (userIds.length === 0) return result;
  const userIdSet = new Set(userIds);
  const authUsers = await listAuthAdminUsers({ page: 1, perPage: 1000 }).catch(() => []);
  for (const authUser of authUsers) {
    if (!authUser?.id || !userIdSet.has(authUser.id)) continue;
    const appMetadata = asRecord(authUser.app_metadata);

    const bannedFlag = readBooleanFlag(appMetadata.wovo_moderation_banned);
    const feedDisabledFlag = readBooleanFlag(appMetadata.wovo_feed_posting_disabled);

    if (bannedFlag === null && feedDisabledFlag === null) continue;
    result.set(authUser.id, {
      banned: bannedFlag ?? false,
      feedPostingDisabled: feedDisabledFlag ?? false,
    });
  }
  return result;
}

export async function getModerationStateMapForUsers(userIds: string[]): Promise<Map<string, ModerationState>> {
  const ids = normalizeUserIds(userIds);
  const result = new Map<string, ModerationState>();
  if (ids.length === 0) return result;

  const [rows, metadataMap] = await Promise.all([
    loadModerationActions(ids),
    loadMetadataModerationMap(ids),
  ]);

  const knownFlags = new Map<string, { banResolved: boolean; feedResolved: boolean }>();
  for (const row of rows ?? []) {
    const targetUserId = row.target_user_id?.trim();
    if (!targetUserId) continue;

    const flags = knownFlags.get(targetUserId) ?? { banResolved: false, feedResolved: false };
    const current = result.get(targetUserId) ?? { ...DEFAULT_STATE };

    if (!flags.banResolved) {
      if (row.action === "ban_account") {
        current.banned = true;
        flags.banResolved = true;
      } else if (row.action === "unban_account") {
        current.banned = false;
        flags.banResolved = true;
      }
    }

    if (!flags.feedResolved) {
      if (row.action === "disable_feed_posting") {
        current.feedPostingDisabled = true;
        flags.feedResolved = true;
      } else if (row.action === "enable_feed_posting") {
        current.feedPostingDisabled = false;
        flags.feedResolved = true;
      }
    }

    knownFlags.set(targetUserId, flags);
    result.set(targetUserId, current);
  }

  for (const userId of ids) {
    const metadataState = metadataMap.get(userId);
    if (metadataState) {
      result.set(userId, {
        banned: metadataState.banned,
        feedPostingDisabled: metadataState.feedPostingDisabled,
      });
      continue;
    }
    if (!result.has(userId)) {
      result.set(userId, { ...DEFAULT_STATE });
    }
  }

  return result;
}

export async function getModerationStateForUser(userId: string): Promise<ModerationState> {
  const map = await getModerationStateMapForUsers([userId]);
  return map.get(userId) ?? { ...DEFAULT_STATE };
}
