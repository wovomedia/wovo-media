import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString } from "@/lib/wovo-ai/feed-utils";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import {
  appendSocialFallbackEvent,
  listSocialFallbackEvents,
} from "@/lib/wovo-ai/social-fallback-store";

type DmActionRow = {
  id: string;
  admin_user_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: unknown;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  full_name?: string | null;
};

type DmMessageRecord = {
  id: string;
  threadId: string;
  senderUserId: string;
  recipientUserId: string;
  content: string;
  createdAt: string;
};

type DmThreadRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  participantUserId: string;
  lastMessage: {
    id: string;
    senderUserId: string;
    content: string;
    createdAt: string;
  } | null;
};

const DM_ACTION_LIST = [
  "dm_thread_open",
  "dm_message",
  "dm_delete_message",
  "dm_block_user",
  "dm_unblock_user",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_SELECT_CANDIDATES = [
  "user_id,username,full_name,updated_at",
  "user_id,username,full_name",
  "user_id,username",
];

export type FallbackDmThread = {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  participant: {
    userId: string;
    username: string;
    displayName: string;
  };
  lastMessage: {
    id: string;
    senderUserId: string;
    content: string;
    createdAt: string;
  } | null;
};

export type FallbackDmMessage = {
  id: string;
  threadId: string;
  senderUserId: string;
  content: string;
  createdAt: string;
  sender: {
    username: string;
    displayName: string;
  };
};

export function isMissingDmTablesError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("dm_threads") ||
    message.includes("dm_messages") ||
    message.includes("dm_blocks") ||
    ((message.includes("could not find the table") || message.includes("relation")) && message.includes("dm_"))
  );
}

function shouldRetryProfileQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column") && message.includes("profiles") && message.includes("schema cache")) ||
    (message.includes("permission denied") && message.includes("profiles"))
  );
}

function orderedPair(userA: string, userB: string): [string, string] {
  return userA.localeCompare(userB) <= 0 ? [userA, userB] : [userB, userA];
}

function isValidUserId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function buildFallbackThreadId(userA: string, userB: string): string {
  const [left, right] = orderedPair(userA, userB);
  return `fallback:${left}:${right}`;
}

export function isFallbackThreadId(threadId: string): boolean {
  const parsed = parseFallbackThreadId(threadId);
  return Boolean(parsed);
}

export function parseFallbackThreadId(threadId: string): [string, string] | null {
  const normalized = threadId.trim();
  if (!normalized.startsWith("fallback:")) return null;
  const parts = normalized.split(":");
  if (parts.length !== 3) return null;
  const userA = parts[1]?.trim() ?? "";
  const userB = parts[2]?.trim() ?? "";
  if (!isValidUserId(userA) || !isValidUserId(userB)) return null;
  const [left, right] = orderedPair(userA, userB);
  return [left, right];
}

function normalizeThreadId(row: DmActionRow): string {
  const metadata = asRecord(row.metadata);
  const fromMetadata = asString(metadata.thread_id).trim();
  if (fromMetadata && isFallbackThreadId(fromMetadata)) return fromMetadata;
  const senderUserId = (row.admin_user_id ?? "").trim();
  const recipientUserId = (row.target_user_id ?? "").trim();
  if (isValidUserId(senderUserId) && isValidUserId(recipientUserId)) {
    return buildFallbackThreadId(senderUserId, recipientUserId);
  }
  return "";
}

function parseMessageRecord(row: DmActionRow): DmMessageRecord | null {
  if (row.action !== "dm_message") return null;
  const senderUserId = (row.admin_user_id ?? "").trim();
  const recipientUserId = (row.target_user_id ?? "").trim();
  if (!isValidUserId(senderUserId) || !isValidUserId(recipientUserId)) return null;

  const metadata = asRecord(row.metadata);
  const content = asString(metadata.content).trim();
  if (!content) return null;

  const threadId = normalizeThreadId(row);
  if (!threadId) return null;

  return {
    id: row.id,
    threadId,
    senderUserId,
    recipientUserId,
    content,
    createdAt: row.created_at,
  };
}

function parseDeletedMessageId(row: DmActionRow): string {
  if (row.action !== "dm_delete_message") return "";
  const metadata = asRecord(row.metadata);
  const messageId = asString(metadata.message_id).trim();
  return messageId;
}

function getBlockKey(blockerUserId: string, blockedUserId: string): string {
  return `${blockerUserId}->${blockedUserId}`;
}

function parseBlockStateFromEvents(events: DmActionRow[]): Map<string, boolean> {
  const blockStateByDirection = new Map<string, boolean>();
  for (const row of events) {
    if (row.action !== "dm_block_user" && row.action !== "dm_unblock_user") continue;
    const blockerUserId = (row.admin_user_id ?? "").trim();
    const blockedUserId = (row.target_user_id ?? "").trim();
    if (!isValidUserId(blockerUserId) || !isValidUserId(blockedUserId)) continue;
    blockStateByDirection.set(getBlockKey(blockerUserId, blockedUserId), row.action === "dm_block_user");
  }
  return blockStateByDirection;
}

function isBlockedBetweenUsers(
  blockStateByDirection: Map<string, boolean>,
  userA: string,
  userB: string,
): boolean {
  return Boolean(
    blockStateByDirection.get(getBlockKey(userA, userB)) ||
      blockStateByDirection.get(getBlockKey(userB, userA)),
  );
}

async function loadEventsForUser(userId: string): Promise<DmActionRow[]> {
  const rows = await listSocialFallbackEvents({
    actions: DM_ACTION_LIST,
    order: "asc",
    limit: 12000,
    userIds: [userId],
  }).catch(() => []);

  const filteredRows = (rows ?? []).filter((row) => {
    const actorId = (row.admin_user_id ?? "").trim().toLowerCase();
    const targetId = (row.target_user_id ?? "").trim().toLowerCase();
    return actorId === userId || targetId === userId;
  });

  return filteredRows.sort((left, right) => {
    const leftTs = Date.parse(left.created_at);
    const rightTs = Date.parse(right.created_at);
    if (leftTs !== rightTs) return leftTs - rightTs;
    return left.id.localeCompare(right.id);
  });
}

async function loadEventsForUsers(userIds: string[]): Promise<DmActionRow[]> {
  const normalizedUserIds = Array.from(new Set(userIds.map((value) => value.trim()).filter(isValidUserId)));
  if (normalizedUserIds.length === 0) return [];

  const rows = await listSocialFallbackEvents({
    actions: DM_ACTION_LIST,
    order: "asc",
    limit: 12000,
    userIds: normalizedUserIds,
  }).catch(() => []);

  const allowed = new Set(normalizedUserIds);
  const filteredRows = (rows ?? []).filter((row) => {
    const actorId = (row.admin_user_id ?? "").trim().toLowerCase();
    const targetId = (row.target_user_id ?? "").trim().toLowerCase();
    return allowed.has(actorId) || allowed.has(targetId);
  });

  return filteredRows.sort((left, right) => {
    const leftTs = Date.parse(left.created_at);
    const rightTs = Date.parse(right.created_at);
    if (leftTs !== rightTs) return leftTs - rightTs;
    return left.id.localeCompare(right.id);
  });
}

async function loadProfileRows(userIds: string[]): Promise<ProfileRow[]> {
  if (userIds.length === 0) return [];
  const encodedIn = encodeURIComponent(`(${userIds.join(",")})`);
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=${select}&user_id=in.${encodedIn}`,
      );
      return rows ?? [];
    } catch (error) {
      lastError = error;
      if (shouldRetryProfileQuery(error)) continue;
      throw error;
    }
  }
  if (lastError && !shouldRetryProfileQuery(lastError)) throw lastError;
  return [];
}

async function resolveDisplayMap(userIds: string[]): Promise<Map<string, { username: string; displayName: string }>> {
  const map = new Map<string, { username: string; displayName: string }>();
  if (userIds.length === 0) return map;

  const profiles = await loadProfileRows(userIds);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    let username = "";
    try {
      username = normalizeUsername(profile?.username ?? "");
    } catch {
      username = "";
    }
    const normalizedUsername = username || `brand_${userId.slice(0, 8)}`;
    const displayName = asString(profile?.full_name).trim() || `@${normalizedUsername}`;
    map.set(userId, {
      username: normalizedUsername,
      displayName,
    });
  }
  return map;
}

function collectMessages(events: DmActionRow[], threadFilter?: string): DmMessageRecord[] {
  const deletedMessageIds = new Set<string>();
  for (const row of events) {
    const deletedMessageId = parseDeletedMessageId(row);
    if (deletedMessageId) deletedMessageIds.add(deletedMessageId);
  }

  const messages: DmMessageRecord[] = [];
  for (const row of events) {
    const message = parseMessageRecord(row);
    if (!message) continue;
    if (threadFilter && message.threadId !== threadFilter) continue;
    if (deletedMessageIds.has(message.id)) continue;
    messages.push(message);
  }
  return messages.sort((left, right) => {
    const leftTs = Date.parse(left.createdAt);
    const rightTs = Date.parse(right.createdAt);
    if (leftTs !== rightTs) return leftTs - rightTs;
    return left.id.localeCompare(right.id);
  });
}

function collectOpenedThreads(events: DmActionRow[]): Map<string, string> {
  const opened = new Map<string, string>();
  for (const row of events) {
    if (row.action !== "dm_thread_open") continue;
    const threadId = normalizeThreadId(row);
    if (!threadId) continue;
    if (!opened.has(threadId)) {
      opened.set(threadId, row.created_at);
    }
  }
  return opened;
}

export async function listFallbackThreadsForUser(userId: string): Promise<FallbackDmThread[]> {
  const events = await loadEventsForUser(userId);
  const blockStateByDirection = parseBlockStateFromEvents(events);
  const messages = collectMessages(events);
  const openedThreads = collectOpenedThreads(events);

  const byThread = new Map<string, DmThreadRecord>();
  for (const [threadId, openedAt] of openedThreads.entries()) {
    const parsed = parseFallbackThreadId(threadId);
    if (!parsed) continue;
    const [left, right] = parsed;
    const participantUserId = left === userId ? right : left;
    if (!isValidUserId(participantUserId)) continue;
    byThread.set(threadId, {
      id: threadId,
      createdAt: openedAt,
      updatedAt: openedAt,
      lastMessageAt: null,
      participantUserId,
      lastMessage: null,
    });
  }

  for (const message of messages) {
    const parsed = parseFallbackThreadId(message.threadId);
    if (!parsed) continue;
    const [left, right] = parsed;
    if (left !== userId && right !== userId) continue;
    const participantUserId = left === userId ? right : left;
    if (!isValidUserId(participantUserId)) continue;
    if (isBlockedBetweenUsers(blockStateByDirection, userId, participantUserId)) {
      continue;
    }
    const current = byThread.get(message.threadId);
    if (!current) {
      byThread.set(message.threadId, {
        id: message.threadId,
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
        lastMessageAt: message.createdAt,
        participantUserId,
        lastMessage: {
          id: message.id,
          senderUserId: message.senderUserId,
          content: message.content,
          createdAt: message.createdAt,
        },
      });
      continue;
    }
    current.updatedAt = message.createdAt;
    current.lastMessageAt = message.createdAt;
    current.lastMessage = {
      id: message.id,
      senderUserId: message.senderUserId,
      content: message.content,
      createdAt: message.createdAt,
    };
    byThread.set(message.threadId, current);
  }

  const threads = Array.from(byThread.values());
  const displayMap = await resolveDisplayMap(
    Array.from(new Set(threads.map((thread) => thread.participantUserId))),
  );

  return threads
    .map((thread) => {
      const participantDisplay = displayMap.get(thread.participantUserId) ?? {
        username: `brand_${thread.participantUserId.slice(0, 8)}`,
        displayName: `@brand_${thread.participantUserId.slice(0, 8)}`,
      };
      return {
        id: thread.id,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        lastMessageAt: thread.lastMessageAt,
        participant: {
          userId: thread.participantUserId,
          username: participantDisplay.username,
          displayName: participantDisplay.displayName,
        },
        lastMessage: thread.lastMessage,
      };
    })
    .sort((left, right) => {
      const leftTs = Date.parse(left.lastMessageAt ?? left.updatedAt);
      const rightTs = Date.parse(right.lastMessageAt ?? right.updatedAt);
      if (leftTs !== rightTs) return rightTs - leftTs;
      return left.id.localeCompare(right.id);
    });
}

export async function createFallbackThreadForUsers(
  currentUserId: string,
  targetUserId: string,
): Promise<FallbackDmThread> {
  const threadId = buildFallbackThreadId(currentUserId, targetUserId);
  const events = await loadEventsForUser(currentUserId);
  const blockStateByDirection = parseBlockStateFromEvents(events);
  if (isBlockedBetweenUsers(blockStateByDirection, currentUserId, targetUserId)) {
    throw new Error("This conversation is blocked.");
  }

  await appendSocialFallbackEvent({
    adminUserId: currentUserId,
    targetUserId,
    action: "dm_thread_open",
    metadata: {
      thread_id: threadId,
      participants: orderedPair(currentUserId, targetUserId),
      source: "wovo_dm_fallback",
    },
  });

  const displayMap = await resolveDisplayMap([targetUserId]);
  const participant = displayMap.get(targetUserId) ?? {
    username: `brand_${targetUserId.slice(0, 8)}`,
    displayName: `@brand_${targetUserId.slice(0, 8)}`,
  };
  const nowIso = new Date().toISOString();
  return {
    id: threadId,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastMessageAt: null,
    participant: {
      userId: targetUserId,
      username: participant.username,
      displayName: participant.displayName,
    },
    lastMessage: null,
  };
}

export async function listFallbackMessagesForThread(
  currentUserId: string,
  threadId: string,
): Promise<FallbackDmMessage[]> {
  const parsed = parseFallbackThreadId(threadId);
  if (!parsed) {
    throw new Error("Thread not found.");
  }
  const [left, right] = parsed;
  if (left !== currentUserId && right !== currentUserId) {
    throw new Error("Thread not found.");
  }

  const events = await loadEventsForUser(currentUserId);
  const messages = collectMessages(events, threadId);
  const senderIds = Array.from(new Set(messages.map((message) => message.senderUserId)));
  const displayMap = await resolveDisplayMap(senderIds);

  return messages.map((message) => {
    const sender = displayMap.get(message.senderUserId) ?? {
      username: `brand_${message.senderUserId.slice(0, 8)}`,
      displayName: `@brand_${message.senderUserId.slice(0, 8)}`,
    };
    return {
      id: message.id,
      threadId: message.threadId,
      senderUserId: message.senderUserId,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        username: sender.username,
        displayName: sender.displayName,
      },
    };
  });
}

export async function sendFallbackMessage(
  currentUserId: string,
  threadId: string,
  content: string,
): Promise<FallbackDmMessage> {
  const parsed = parseFallbackThreadId(threadId);
  if (!parsed) {
    throw new Error("Thread not found.");
  }
  const [left, right] = parsed;
  if (left !== currentUserId && right !== currentUserId) {
    throw new Error("Thread not found.");
  }

  const recipientUserId = left === currentUserId ? right : left;
  const events = await loadEventsForUser(currentUserId);
  const blockStateByDirection = parseBlockStateFromEvents(events);
  if (isBlockedBetweenUsers(blockStateByDirection, currentUserId, recipientUserId)) {
    throw new Error("Messaging is blocked for this user.");
  }

  const inserted = await appendSocialFallbackEvent({
    adminUserId: currentUserId,
    targetUserId: recipientUserId,
    action: "dm_message",
    metadata: {
      thread_id: threadId,
      participants: orderedPair(currentUserId, recipientUserId),
      content,
      source: "wovo_dm_fallback",
    },
  });
  const message = inserted
    ? parseMessageRecord({
        id: inserted.id,
        admin_user_id: inserted.admin_user_id,
        target_user_id: inserted.target_user_id,
        action: inserted.action,
        metadata: inserted.metadata,
        created_at: inserted.created_at,
      })
    : null;
  if (!message) {
    throw new Error("Unable to send message.");
  }

  const displayMap = await resolveDisplayMap([currentUserId]);
  const sender = displayMap.get(currentUserId) ?? {
    username: `brand_${currentUserId.slice(0, 8)}`,
    displayName: `@brand_${currentUserId.slice(0, 8)}`,
  };
  return {
    id: message.id,
    threadId: message.threadId,
    senderUserId: message.senderUserId,
    content: message.content,
    createdAt: message.createdAt,
    sender: {
      username: sender.username,
      displayName: sender.displayName,
    },
  };
}

export async function deleteFallbackMessage(
  currentUserId: string,
  threadId: string,
  messageId: string,
): Promise<void> {
  const messages = await listFallbackMessagesForThread(currentUserId, threadId);
  const message = messages.find((item) => item.id === messageId);
  if (!message) {
    throw new Error("Message not found.");
  }
  if (message.senderUserId !== currentUserId) {
    throw new Error("You can only delete your own messages.");
  }

  const parsed = parseFallbackThreadId(threadId);
  const recipientUserId = parsed ? (parsed[0] === currentUserId ? parsed[1] : parsed[0]) : null;
  await appendSocialFallbackEvent({
    adminUserId: currentUserId,
    targetUserId: recipientUserId,
    action: "dm_delete_message",
    metadata: {
      thread_id: threadId,
      message_id: messageId,
      source: "wovo_dm_fallback",
    },
  });
}

export async function setFallbackMessagingBlockState(
  currentUserId: string,
  targetUserId: string,
  shouldBlock: boolean,
): Promise<boolean> {
  await appendSocialFallbackEvent({
    adminUserId: currentUserId,
    targetUserId,
    action: shouldBlock ? "dm_block_user" : "dm_unblock_user",
    metadata: {
      blocker_user_id: currentUserId,
      blocked_user_id: targetUserId,
      source: "wovo_dm_fallback",
    },
  });
  return shouldBlock;
}

export async function listFallbackBlockedUsersByViewer(
  currentUserId: string,
  targetUserIds?: string[],
): Promise<Set<string>> {
  const events = await loadEventsForUser(currentUserId);
  const blockStateByDirection = parseBlockStateFromEvents(events);
  const allowedTargets = targetUserIds
    ? new Set(targetUserIds.map((value) => value.trim()).filter(isValidUserId))
    : null;
  const blocked = new Set<string>();

  for (const [direction, isBlocked] of blockStateByDirection.entries()) {
    if (!isBlocked) continue;
    const [blockerUserId, blockedUserId] = direction.split("->");
    if (blockerUserId !== currentUserId) continue;
    if (allowedTargets && !allowedTargets.has(blockedUserId)) continue;
    blocked.add(blockedUserId);
  }

  return blocked;
}

export async function isFallbackMessagingBlockedBetween(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (!isValidUserId(userA) || !isValidUserId(userB)) return false;
  const events = await loadEventsForUsers([userA, userB]);
  const blockStateByDirection = parseBlockStateFromEvents(events);
  return isBlockedBetweenUsers(blockStateByDirection, userA, userB);
}
