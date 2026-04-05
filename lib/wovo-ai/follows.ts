import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isUuid } from "@/lib/wovo-ai/feed-utils";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import {
  appendSocialFallbackEvent,
  listSocialFallbackEvents,
} from "@/lib/wovo-ai/social-fallback-store";

type UserFollowRow = {
  follower_user_id: string;
  following_user_id: string;
};

type FollowActionRow = {
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

type FollowSnapshot = {
  activeEdges: Set<string>;
  followersCountByUser: Map<string, number>;
  followingCountByUser: Map<string, number>;
};

export type FollowSummary = {
  followedByViewer: Set<string>;
  followersCountByUser: Map<string, number>;
};

export type FollowProfileStats = {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export type FollowProfileListItem = {
  userId: string;
  username: string;
  displayName: string;
  isFollowedByViewer: boolean;
};

const FOLLOW_ACTION_LIST = ["follow_user", "unfollow_user"];

const PROFILE_SELECT_CANDIDATES = [
  "user_id,username,full_name,updated_at",
  "user_id,username,full_name",
  "user_id,username",
];

function edgeKey(followerUserId: string, followingUserId: string): string {
  return `${followerUserId}->${followingUserId}`;
}

function encodeInClause(values: string[]): string {
  return encodeURIComponent(`(${values.join(",")})`);
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

export function isMissingUserFollowsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("user_follows") ||
    (message.includes("could not find the table") && message.includes("follows")) ||
    (message.includes("relation") && message.includes("user_follows") && message.includes("does not exist"))
  );
}

function parseFollowAction(row: FollowActionRow): { followerUserId: string; followingUserId: string; followed: boolean } | null {
  if (row.action !== "follow_user" && row.action !== "unfollow_user") {
    return null;
  }
  const metadata = asRecord(row.metadata);
  const followerUserId =
    asString(metadata.follower_user_id).trim() || (row.admin_user_id ?? "").trim();
  const followingUserId =
    asString(metadata.following_user_id).trim() || (row.target_user_id ?? "").trim();
  if (!isUuid(followerUserId) || !isUuid(followingUserId)) return null;
  if (followerUserId === followingUserId) return null;
  return {
    followerUserId,
    followingUserId,
    followed: row.action === "follow_user",
  };
}

async function loadFallbackFollowSnapshot(): Promise<FollowSnapshot> {
  const rows = await listSocialFallbackEvents({
    actions: FOLLOW_ACTION_LIST,
    order: "desc",
    limit: 8000,
  }).catch(() => []);

  const resolvedByEdge = new Map<string, boolean>();
  for (const row of rows ?? []) {
    const parsed = parseFollowAction(row);
    if (!parsed) continue;
    const key = edgeKey(parsed.followerUserId, parsed.followingUserId);
    if (!resolvedByEdge.has(key)) {
      resolvedByEdge.set(key, parsed.followed);
    }
  }

  const activeEdges = new Set<string>();
  const followersCountByUser = new Map<string, number>();
  const followingCountByUser = new Map<string, number>();
  for (const [key, isFollowed] of resolvedByEdge.entries()) {
    if (!isFollowed) continue;
    activeEdges.add(key);
    const [followerUserId, followingUserId] = key.split("->");
    followersCountByUser.set(
      followingUserId,
      (followersCountByUser.get(followingUserId) ?? 0) + 1,
    );
    followingCountByUser.set(
      followerUserId,
      (followingCountByUser.get(followerUserId) ?? 0) + 1,
    );
  }

  return {
    activeEdges,
    followersCountByUser,
    followingCountByUser,
  };
}

function toFollowSummaryFromSnapshot(
  snapshot: FollowSnapshot,
  viewerUserId: string,
  targetUserIds: string[],
): FollowSummary {
  const followedByViewer = new Set<string>();
  const followersCountByUser = new Map<string, number>();
  for (const targetUserId of targetUserIds) {
    const key = edgeKey(viewerUserId, targetUserId);
    if (snapshot.activeEdges.has(key)) {
      followedByViewer.add(targetUserId);
    }
    followersCountByUser.set(targetUserId, snapshot.followersCountByUser.get(targetUserId) ?? 0);
  }
  return {
    followedByViewer,
    followersCountByUser,
  };
}

export async function resolveFollowSummary(
  viewerUserId: string,
  targetUserIdsInput: string[],
): Promise<FollowSummary> {
  const targetUserIds = Array.from(
    new Set(
      targetUserIdsInput
        .map((userId) => userId.trim())
        .filter((userId) => isUuid(userId)),
    ),
  );
  if (targetUserIds.length === 0) {
    return {
      followedByViewer: new Set<string>(),
      followersCountByUser: new Map<string, number>(),
    };
  }

  try {
    const encodedTargetIn = encodeInClause(targetUserIds);
    const [viewerRows, followerRows] = await Promise.all([
      supabaseServiceRoleRequest<Array<{ following_user_id: string }>>(
        `/rest/v1/user_follows?select=following_user_id&follower_user_id=eq.${encodeURIComponent(viewerUserId)}&following_user_id=in.${encodedTargetIn}`,
      ),
      supabaseServiceRoleRequest<Array<{ following_user_id: string }>>(
        `/rest/v1/user_follows?select=following_user_id&following_user_id=in.${encodedTargetIn}`,
      ),
    ]);

    const followedByViewer = new Set<string>((viewerRows ?? []).map((row) => row.following_user_id));
    const followersCountByUser = new Map<string, number>();
    for (const targetUserId of targetUserIds) {
      followersCountByUser.set(targetUserId, 0);
    }
    for (const row of followerRows ?? []) {
      followersCountByUser.set(
        row.following_user_id,
        (followersCountByUser.get(row.following_user_id) ?? 0) + 1,
      );
    }
    return {
      followedByViewer,
      followersCountByUser,
    };
  } catch (error) {
    if (!isMissingUserFollowsTableError(error)) throw error;
    const snapshot = await loadFallbackFollowSnapshot();
    return toFollowSummaryFromSnapshot(snapshot, viewerUserId, targetUserIds);
  }
}

export async function resolveProfileFollowStats(
  viewerUserId: string,
  targetUserId: string,
  isOwnProfile: boolean,
): Promise<FollowProfileStats> {
  if (!isUuid(targetUserId)) {
    return {
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
    };
  }

  try {
    const [followersRows, followingRows, isFollowingRows] = await Promise.all([
      supabaseServiceRoleRequest<Array<{ follower_user_id: string }>>(
        `/rest/v1/user_follows?select=follower_user_id&following_user_id=eq.${encodeURIComponent(targetUserId)}`,
      ),
      supabaseServiceRoleRequest<Array<{ following_user_id: string }>>(
        `/rest/v1/user_follows?select=following_user_id&follower_user_id=eq.${encodeURIComponent(targetUserId)}`,
      ),
      isOwnProfile
        ? Promise.resolve<Array<{ follower_user_id: string }> | null>([])
        : supabaseServiceRoleRequest<Array<{ follower_user_id: string }>>(
            `/rest/v1/user_follows?select=follower_user_id&follower_user_id=eq.${encodeURIComponent(viewerUserId)}&following_user_id=eq.${encodeURIComponent(targetUserId)}&limit=1`,
          ),
    ]);

    return {
      followersCount: followersRows?.length ?? 0,
      followingCount: followingRows?.length ?? 0,
      isFollowing: Boolean(isFollowingRows?.length),
    };
  } catch (error) {
    if (!isMissingUserFollowsTableError(error)) throw error;
    const snapshot = await loadFallbackFollowSnapshot();
    return {
      followersCount: snapshot.followersCountByUser.get(targetUserId) ?? 0,
      followingCount: snapshot.followingCountByUser.get(targetUserId) ?? 0,
      isFollowing: isOwnProfile ? false : snapshot.activeEdges.has(edgeKey(viewerUserId, targetUserId)),
    };
  }
}

export async function applyFollowAction(
  followerUserId: string,
  followingUserId: string,
  shouldFollow: boolean,
): Promise<{ followersCount: number; isFollowing: boolean }> {
  try {
    if (shouldFollow) {
      await supabaseServiceRoleRequest("/rest/v1/user_follows?on_conflict=follower_user_id,following_user_id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          follower_user_id: followerUserId,
          following_user_id: followingUserId,
        }),
      });
    } else {
      await supabaseServiceRoleRequest(
        `/rest/v1/user_follows?follower_user_id=eq.${encodeURIComponent(followerUserId)}&following_user_id=eq.${encodeURIComponent(followingUserId)}`,
        { method: "DELETE" },
      );
    }
  } catch (error) {
    if (!isMissingUserFollowsTableError(error)) throw error;
    await appendSocialFallbackEvent({
      adminUserId: followerUserId,
      targetUserId: followingUserId,
      action: shouldFollow ? "follow_user" : "unfollow_user",
      metadata: {
        follower_user_id: followerUserId,
        following_user_id: followingUserId,
        source: "wovo_social_fallback",
      },
    });
  }

  const summary = await resolveFollowSummary(followerUserId, [followingUserId]);
  return {
    followersCount: summary.followersCountByUser.get(followingUserId) ?? 0,
    isFollowing: summary.followedByViewer.has(followingUserId),
  };
}

async function loadProfileRows(userIds: string[]): Promise<ProfileRow[]> {
  if (userIds.length === 0) return [];
  const encodedIn = encodeInClause(userIds);
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

export async function listFollowProfiles(
  targetUserId: string,
  type: "followers" | "following",
  viewerUserId: string,
): Promise<FollowProfileListItem[]> {
  let relatedUserIds: string[] = [];
  try {
    if (type === "followers") {
      const rows = await supabaseServiceRoleRequest<UserFollowRow[]>(
        `/rest/v1/user_follows?select=follower_user_id,following_user_id&following_user_id=eq.${encodeURIComponent(targetUserId)}&limit=400`,
      );
      relatedUserIds = (rows ?? []).map((row) => row.follower_user_id);
    } else {
      const rows = await supabaseServiceRoleRequest<UserFollowRow[]>(
        `/rest/v1/user_follows?select=follower_user_id,following_user_id&follower_user_id=eq.${encodeURIComponent(targetUserId)}&limit=400`,
      );
      relatedUserIds = (rows ?? []).map((row) => row.following_user_id);
    }
  } catch (error) {
    if (!isMissingUserFollowsTableError(error)) throw error;
    const snapshot = await loadFallbackFollowSnapshot();
    const ids: string[] = [];
    for (const edge of snapshot.activeEdges) {
      const [followerUserId, followingUserId] = edge.split("->");
      if (type === "followers" && followingUserId === targetUserId) {
        ids.push(followerUserId);
      }
      if (type === "following" && followerUserId === targetUserId) {
        ids.push(followingUserId);
      }
    }
    relatedUserIds = ids;
  }

  const uniqueUserIds = Array.from(new Set(relatedUserIds.filter((userId) => isUuid(userId))));
  if (uniqueUserIds.length === 0) return [];

  const [profiles, viewerSummary] = await Promise.all([
    loadProfileRows(uniqueUserIds),
    resolveFollowSummary(viewerUserId, uniqueUserIds),
  ]);
  const profileMap = new Map((profiles ?? []).map((row) => [row.user_id, row]));

  return uniqueUserIds.map((userId) => {
    const profile = profileMap.get(userId);
    let username = "";
    try {
      username = normalizeUsername(profile?.username ?? "");
    } catch {
      username = "";
    }
    const normalizedUsername = username || `brand_${userId.slice(0, 8)}`;
    const displayName = asString(profile?.full_name).trim() || `@${normalizedUsername}`;
    return {
      userId,
      username: normalizedUsername,
      displayName,
      isFollowedByViewer: viewerSummary.followedByViewer.has(userId),
    };
  });
}
