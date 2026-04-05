import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, isUuid } from "@/lib/wovo-ai/feed-utils";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import {
  appendSocialFallbackEvent,
  listSocialFallbackEvents,
} from "@/lib/wovo-ai/social-fallback-store";

type EngagementActionRow = {
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

type FallbackCommentRecord = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type FallbackCommentView = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type FallbackEngagementSummary = {
  likesCountByPost: Map<string, number>;
  likedByViewerPostIds: Set<string>;
  commentsCountByPost: Map<string, number>;
  repostsCountByPost: Map<string, number>;
  repostedByViewerPostIds: Set<string>;
};

const ENGAGEMENT_ACTION_LIST = [
  "like_post",
  "unlike_post",
  "repost_post",
  "unrepost_post",
  "comment_post",
  "delete_comment_post",
];
const PROFILE_SELECT_CANDIDATES = [
  "user_id,username,full_name,updated_at",
  "user_id,username,full_name",
  "user_id,username",
];

function encodeInClause(values: string[]): string {
  return encodeURIComponent(`(${values.join(",")})`);
}

function eventTimestampMs(event: EngagementActionRow): number {
  const ts = Date.parse(event.created_at);
  return Number.isFinite(ts) ? ts : 0;
}

function byCreatedAtAsc(left: EngagementActionRow, right: EngagementActionRow): number {
  const leftTs = eventTimestampMs(left);
  const rightTs = eventTimestampMs(right);
  if (leftTs !== rightTs) return leftTs - rightTs;
  return left.id.localeCompare(right.id);
}

function shouldRetryProfileQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") &&
      message.includes("column") &&
      message.includes("profiles") &&
      message.includes("schema cache")) ||
    (message.includes("permission denied") && message.includes("profiles"))
  );
}

function normalizePostId(value: unknown): string {
  const normalized = asString(value).trim().toLowerCase();
  return isUuid(normalized) ? normalized : "";
}

function normalizeActorUserId(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return isUuid(normalized) ? normalized : "";
}

function parseCommentId(metadata: Record<string, unknown>): string {
  const commentId = asString(metadata.comment_id).trim().toLowerCase();
  return isUuid(commentId) ? commentId : "";
}

export function isMissingPostLikesTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("post_likes") ||
    ((message.includes("could not find the table") || message.includes("relation")) &&
      message.includes("post_likes"))
  );
}

export function isMissingPostCommentsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("post_comments") ||
    ((message.includes("could not find the table") || message.includes("relation")) &&
      message.includes("post_comments"))
  );
}

export function isMissingPostRepostsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("post_reposts") ||
    ((message.includes("could not find the table") || message.includes("relation")) &&
      message.includes("post_reposts"))
  );
}

async function loadEngagementEvents(): Promise<EngagementActionRow[]> {
  const rows = await listSocialFallbackEvents({
    actions: ENGAGEMENT_ACTION_LIST,
    order: "asc",
    limit: 12000,
  }).catch(() => []);
  return (rows ?? []).slice().sort(byCreatedAtAsc);
}

function buildFallbackComments(
  events: EngagementActionRow[],
  postFilter: Set<string> | null,
): FallbackCommentRecord[] {
  const commentsById = new Map<string, FallbackCommentRecord>();

  for (const event of events) {
    const metadata = asRecord(event.metadata);
    const postId = normalizePostId(metadata.post_id);
    const actorUserId = normalizeActorUserId(event.admin_user_id);
    if (!postId || !actorUserId) continue;
    if (postFilter && !postFilter.has(postId)) continue;

    if (event.action === "comment_post") {
      const commentId =
        parseCommentId(metadata) || (isUuid(event.id) ? event.id.toLowerCase() : "");
      const content = asString(metadata.content).trim();
      if (!commentId || !content) continue;
      commentsById.set(commentId, {
        id: commentId,
        postId,
        userId: actorUserId,
        content,
        createdAt: event.created_at,
        updatedAt: event.created_at,
      });
      continue;
    }

    if (event.action === "delete_comment_post") {
      const deletedCommentId = parseCommentId(metadata);
      if (deletedCommentId) {
        commentsById.delete(deletedCommentId);
      }
    }
  }

  return Array.from(commentsById.values()).sort((left, right) => {
    const leftTs = Date.parse(left.createdAt);
    const rightTs = Date.parse(right.createdAt);
    if (leftTs !== rightTs) return rightTs - leftTs;
    return left.id.localeCompare(right.id);
  });
}

function summarizeReactionState(params: {
  events: EngagementActionRow[];
  postIds: Set<string>;
  viewerUserId: string;
  positiveAction: string;
  negativeAction: string;
}): { countsByPost: Map<string, number>; activeByViewer: Set<string> } {
  const stateByEdge = new Map<string, boolean>();

  for (const event of params.events) {
    if (event.action !== params.positiveAction && event.action !== params.negativeAction) {
      continue;
    }
    const metadata = asRecord(event.metadata);
    const postId = normalizePostId(metadata.post_id);
    const actorUserId = normalizeActorUserId(event.admin_user_id);
    if (!postId || !actorUserId || !params.postIds.has(postId)) continue;
    const edge = `${postId}:${actorUserId}`;
    stateByEdge.set(edge, event.action === params.positiveAction);
  }

  const countsByPost = new Map<string, number>();
  const activeByViewer = new Set<string>();
  for (const postId of params.postIds) {
    countsByPost.set(postId, 0);
  }

  for (const [edge, isActive] of stateByEdge.entries()) {
    if (!isActive) continue;
    const [postId, actorUserId] = edge.split(":");
    countsByPost.set(postId, (countsByPost.get(postId) ?? 0) + 1);
    if (actorUserId === params.viewerUserId) {
      activeByViewer.add(postId);
    }
  }

  return { countsByPost, activeByViewer };
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

async function toCommentViews(records: FallbackCommentRecord[]): Promise<FallbackCommentView[]> {
  const userIds = Array.from(new Set(records.map((comment) => comment.userId)));
  const profiles = await loadProfileRows(userIds);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  return records.map((record) => {
    const profile = profileMap.get(record.userId);
    let username = "";
    try {
      username = normalizeUsername(profile?.username ?? "");
    } catch {
      username = "";
    }
    const normalizedUsername = username || `brand_${record.userId.slice(0, 8)}`;
    const displayName =
      asString(profile?.full_name).trim() || `@${normalizedUsername}`;
    return {
      id: record.id,
      postId: record.postId,
      userId: record.userId,
      content: record.content,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      author: {
        username: normalizedUsername,
        displayName,
        avatarUrl: null,
      },
    };
  });
}

export async function resolveFallbackEngagementSummary(
  postIdsInput: string[],
  viewerUserId: string,
): Promise<FallbackEngagementSummary> {
  const normalizedPostIds = Array.from(
    new Set(postIdsInput.map((postId) => normalizePostId(postId)).filter(Boolean)),
  );
  const postIds = new Set(normalizedPostIds);
  if (postIds.size === 0) {
    return {
      likesCountByPost: new Map<string, number>(),
      likedByViewerPostIds: new Set<string>(),
      commentsCountByPost: new Map<string, number>(),
      repostsCountByPost: new Map<string, number>(),
      repostedByViewerPostIds: new Set<string>(),
    };
  }

  const events = await loadEngagementEvents();
  const likes = summarizeReactionState({
    events,
    postIds,
    viewerUserId: normalizeActorUserId(viewerUserId),
    positiveAction: "like_post",
    negativeAction: "unlike_post",
  });
  const reposts = summarizeReactionState({
    events,
    postIds,
    viewerUserId: normalizeActorUserId(viewerUserId),
    positiveAction: "repost_post",
    negativeAction: "unrepost_post",
  });
  const comments = buildFallbackComments(events, postIds);

  const commentsCountByPost = new Map<string, number>();
  for (const postId of postIds) {
    commentsCountByPost.set(postId, 0);
  }
  for (const comment of comments) {
    commentsCountByPost.set(
      comment.postId,
      (commentsCountByPost.get(comment.postId) ?? 0) + 1,
    );
  }

  return {
    likesCountByPost: likes.countsByPost,
    likedByViewerPostIds: likes.activeByViewer,
    commentsCountByPost,
    repostsCountByPost: reposts.countsByPost,
    repostedByViewerPostIds: reposts.activeByViewer,
  };
}

export async function getFallbackLikeState(postId: string, viewerUserId: string): Promise<{
  likesCount: number;
  likedByViewer: boolean;
}> {
  const summary = await resolveFallbackEngagementSummary([postId], viewerUserId);
  return {
    likesCount: summary.likesCountByPost.get(normalizePostId(postId)) ?? 0,
    likedByViewer: summary.likedByViewerPostIds.has(normalizePostId(postId)),
  };
}

export async function applyFallbackLikeAction(
  userId: string,
  postId: string,
  shouldLike: boolean,
): Promise<{ likesCount: number; likedByViewer: boolean }> {
  await appendSocialFallbackEvent({
    adminUserId: userId,
    targetUserId: userId,
    action: shouldLike ? "like_post" : "unlike_post",
    metadata: {
      post_id: normalizePostId(postId),
      source: "wovo_engagement_fallback",
    },
  });
  return await getFallbackLikeState(postId, userId);
}

export async function getFallbackRepostState(postId: string, viewerUserId: string): Promise<{
  repostsCount: number;
  repostedByViewer: boolean;
}> {
  const summary = await resolveFallbackEngagementSummary([postId], viewerUserId);
  return {
    repostsCount: summary.repostsCountByPost.get(normalizePostId(postId)) ?? 0,
    repostedByViewer: summary.repostedByViewerPostIds.has(normalizePostId(postId)),
  };
}

export async function applyFallbackRepostAction(
  userId: string,
  postId: string,
  shouldRepost: boolean,
): Promise<{ repostsCount: number; repostedByViewer: boolean }> {
  await appendSocialFallbackEvent({
    adminUserId: userId,
    targetUserId: userId,
    action: shouldRepost ? "repost_post" : "unrepost_post",
    metadata: {
      post_id: normalizePostId(postId),
      source: "wovo_engagement_fallback",
    },
  });
  return await getFallbackRepostState(postId, userId);
}

export async function listFallbackComments(postId: string): Promise<FallbackCommentView[]> {
  const normalizedPostId = normalizePostId(postId);
  if (!normalizedPostId) return [];
  const events = await loadEngagementEvents();
  const comments = buildFallbackComments(events, new Set([normalizedPostId]));
  return await toCommentViews(comments);
}

export async function addFallbackComment(
  userId: string,
  postId: string,
  content: string,
): Promise<FallbackCommentView[]> {
  const normalizedPostId = normalizePostId(postId);
  const normalizedContent = content.trim();
  if (!normalizedPostId || !normalizedContent) return [];

  await appendSocialFallbackEvent({
    adminUserId: userId,
    targetUserId: userId,
    action: "comment_post",
    metadata: {
      post_id: normalizedPostId,
      comment_id: crypto.randomUUID(),
      content: normalizedContent,
      source: "wovo_engagement_fallback",
    },
  });

  return await listFallbackComments(normalizedPostId);
}

export async function deleteFallbackCommentById(
  userId: string,
  commentId: string,
): Promise<{ postId: string; comments: FallbackCommentView[] }> {
  const normalizedCommentId = asString(commentId).trim().toLowerCase();
  if (!isUuid(normalizedCommentId)) {
    throw new Error("Valid commentId is required.");
  }

  const events = await loadEngagementEvents();
  const allComments = buildFallbackComments(events, null);
  const target = allComments.find((comment) => comment.id === normalizedCommentId);
  if (!target) {
    throw new Error("Comment not found.");
  }
  if (target.userId !== normalizeActorUserId(userId)) {
    throw new Error("Comment not found.");
  }

  await appendSocialFallbackEvent({
    adminUserId: userId,
    targetUserId: userId,
    action: "delete_comment_post",
    metadata: {
      post_id: target.postId,
      comment_id: normalizedCommentId,
      source: "wovo_engagement_fallback",
    },
  });

  return {
    postId: target.postId,
    comments: await listFallbackComments(target.postId),
  };
}
