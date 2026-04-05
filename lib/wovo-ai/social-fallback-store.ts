import { randomUUID } from "node:crypto";
import {
  getAuthAdminUserById,
  listAuthAdminUsers,
  supabaseServiceRoleRequest,
  updateAuthUserById,
  type AuthUser,
} from "@/lib/supabase/server";

export type SocialFallbackEvent = {
  id: string;
  admin_user_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ListSocialEventOptions = {
  actions?: string[];
  order?: "asc" | "desc";
  limit?: number;
  userIds?: string[];
};

const SOCIAL_EVENTS_METADATA_KEY = "wovo_social_events";
const MAX_EVENTS_PER_USER = 5000;

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

function isMissingAdminActionsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("admin_actions") ||
    ((message.includes("relation") || message.includes("could not find the table")) &&
      message.includes("admin_actions"))
  );
}

function parseSocialEvent(value: unknown): SocialFallbackEvent | null {
  const row = asRecord(value);
  const id = asString(row.id).trim();
  const action = asString(row.action).trim();
  const createdAt = asString(row.created_at).trim();
  if (!id || !action || !createdAt) return null;
  const adminUserIdRaw = asString(row.admin_user_id).trim().toLowerCase();
  const targetUserIdRaw = asString(row.target_user_id).trim().toLowerCase();

  return {
    id,
    admin_user_id: isUuid(adminUserIdRaw) ? adminUserIdRaw : null,
    target_user_id: isUuid(targetUserIdRaw) ? targetUserIdRaw : null,
    action,
    metadata: asRecord(row.metadata),
    created_at: createdAt,
  };
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const id = row.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

async function listAllAuthUsers(): Promise<AuthUser[]> {
  const allUsers: AuthUser[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 30; page += 1) {
    const users = await listAuthAdminUsers({ page, perPage }).catch(() => []);
    allUsers.push(...users);
    if (users.length < perPage) break;
  }
  return allUsers;
}

async function listAuthUsersByIds(userIds: string[]): Promise<AuthUser[]> {
  if (userIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(userIds.map((value) => value.trim().toLowerCase()).filter(isUuid)));
  if (uniqueIds.length === 0) return [];

  const rows = await Promise.all(
    uniqueIds.map((userId) => getAuthAdminUserById(userId).catch(() => null)),
  );
  return rows.filter((row): row is AuthUser => Boolean(row?.id));
}

function toEventListFromAuthUser(user: AuthUser): SocialFallbackEvent[] {
  const appMetadata = asRecord(user.app_metadata);
  const list = Array.isArray(appMetadata[SOCIAL_EVENTS_METADATA_KEY]) ? appMetadata[SOCIAL_EVENTS_METADATA_KEY] : [];
  return uniqueById(
    list
      .map((item) => parseSocialEvent(item))
      .filter((item): item is SocialFallbackEvent => Boolean(item)),
  );
}

function buildRestQuery(options: Required<Pick<ListSocialEventOptions, "actions" | "order" | "limit">>) {
  const actionFilter = options.actions.length > 0 ? `&action=in.(${options.actions.join(",")})` : "";
  return `/rest/v1/admin_actions?select=id,admin_user_id,target_user_id,action,metadata,created_at${actionFilter}&order=created_at.${options.order}&limit=${options.limit}`;
}

function sortByCreatedAt(events: SocialFallbackEvent[], order: "asc" | "desc"): SocialFallbackEvent[] {
  return events.sort((left, right) => {
    const leftTs = Date.parse(left.created_at);
    const rightTs = Date.parse(right.created_at);
    const leftSafe = Number.isFinite(leftTs) ? leftTs : 0;
    const rightSafe = Number.isFinite(rightTs) ? rightTs : 0;
    if (leftSafe !== rightSafe) {
      return order === "asc" ? leftSafe - rightSafe : rightSafe - leftSafe;
    }
    return order === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
  });
}

export async function appendSocialFallbackEvent(input: {
  adminUserId: string;
  targetUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<SocialFallbackEvent> {
  const nowIso = new Date().toISOString();
  const actorUserId = input.adminUserId.trim().toLowerCase();
  const targetUserId = (input.targetUserId ?? "").trim().toLowerCase();
  const event: SocialFallbackEvent = {
    id: randomUUID(),
    admin_user_id: isUuid(actorUserId) ? actorUserId : null,
    target_user_id: isUuid(targetUserId) ? targetUserId : null,
    action: input.action,
    metadata: input.metadata ?? {},
    created_at: nowIso,
  };

  try {
    const rows = await supabaseServiceRoleRequest<SocialFallbackEvent[]>(
      "/rest/v1/admin_actions?select=id,admin_user_id,target_user_id,action,metadata,created_at",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          admin_user_id: event.admin_user_id,
          target_user_id: event.target_user_id,
          action: event.action,
          metadata: event.metadata,
        }),
      },
    );
    const inserted = rows?.[0];
    if (inserted) return inserted;
    return event;
  } catch (error) {
    if (!isMissingAdminActionsTableError(error)) throw error;
  }

  const appendEventToAuthUser = async (userId: string): Promise<void> => {
    const authUser = await getAuthAdminUserById(userId).catch(() => null);
    if (!authUser?.id) return;

    const appMetadata = asRecord(authUser.app_metadata);
    const existing = toEventListFromAuthUser(authUser);
    const nextEvents = [event, ...existing.filter((item) => item.id !== event.id)].slice(0, MAX_EVENTS_PER_USER);

    await updateAuthUserById(authUser.id, {
      app_metadata: {
        ...appMetadata,
        [SOCIAL_EVENTS_METADATA_KEY]: nextEvents,
      },
    }).catch(() => undefined);
  };

  if (isUuid(actorUserId)) {
    await appendEventToAuthUser(actorUserId);
  }
  if (isUuid(targetUserId) && targetUserId !== actorUserId) {
    await appendEventToAuthUser(targetUserId);
  }

  return event;
}

export async function listSocialFallbackEvents(options?: ListSocialEventOptions): Promise<SocialFallbackEvent[]> {
  const actions = options?.actions ?? [];
  const order = options?.order ?? "desc";
  const limit = Math.max(1, Math.min(options?.limit ?? 12000, 20000));
  const userIds = new Set((options?.userIds ?? []).map((value) => value.trim().toLowerCase()).filter((value) => isUuid(value)));

  try {
    const rows = await supabaseServiceRoleRequest<SocialFallbackEvent[]>(
      buildRestQuery({ actions, order, limit }),
    );
    const parsed = uniqueById((rows ?? []).map((row) => parseSocialEvent(row)).filter((row): row is SocialFallbackEvent => Boolean(row)));
    const filtered = userIds.size > 0
      ? parsed.filter((event) =>
          (event.admin_user_id && userIds.has(event.admin_user_id)) ||
          (event.target_user_id && userIds.has(event.target_user_id)),
        )
      : parsed;
    return filtered.slice(0, limit);
  } catch (error) {
    if (!isMissingAdminActionsTableError(error)) throw error;
  }

  const authUsers =
    userIds.size > 0
      ? await listAuthUsersByIds(Array.from(userIds)).catch(() => [])
      : await listAllAuthUsers().catch(() => []);
  let events = authUsers.flatMap((user) => toEventListFromAuthUser(user));

  if (actions.length > 0) {
    const actionSet = new Set(actions);
    events = events.filter((event) => actionSet.has(event.action));
  }
  if (userIds.size > 0) {
    events = events.filter((event) =>
      (event.admin_user_id && userIds.has(event.admin_user_id)) ||
      (event.target_user_id && userIds.has(event.target_user_id)),
    );
  }

  return sortByCreatedAt(uniqueById(events), order).slice(0, limit);
}
