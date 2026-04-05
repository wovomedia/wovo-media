import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, getDistribution, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { resolveBadgeMapForUsers } from "@/lib/wovo-ai/badges";
import { getModerationStateMapForUsers } from "@/lib/wovo-ai/moderation";
import { resolveFollowSummary } from "@/lib/wovo-ai/follows";
import {
  isMissingPostCommentsTableError,
  isMissingPostLikesTableError,
  isMissingPostRepostsTableError,
  resolveFallbackEngagementSummary,
} from "@/lib/wovo-ai/engagement-fallback";

type GenerationRow = {
  id: string;
  user_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

type FeedItem = {
  id: string;
  createdAt: string;
  module: string;
  prompt: string;
  text: string;
  image: string | null;
  video: string | null;
  brandName: string;
  channels: string[];
  isMine: boolean;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  likedByViewer: boolean;
  repostedByViewer: boolean;
  isBoosted: boolean;
  boostMultiplier: number;
  boostedUntil: string | null;
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    followersCount: number;
    isFollowedByViewer: boolean;
    isVerified: boolean;
    badgeType: "none" | "verified" | "gold";
  };
};

type ViewerBoostInfo = {
  isVerified: boolean;
  canBoost: boolean;
  cooldownEndsAt: string | null;
  activePostId: string | null;
  boostMultiplier: number;
};

type BoostMetadata = {
  userId: string;
  multiplier: number;
  boostedAt: string;
  activeUntil: string;
};

function hoursSince(timestampIso: string): number {
  const ts = Date.parse(timestampIso);
  if (Number.isNaN(ts)) return 24;
  return Math.max((Date.now() - ts) / (1000 * 60 * 60), 0);
}

function computeRankingScore(input: {
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  followersCount: number;
  isFollowedByViewer: boolean;
  likedByViewer: boolean;
  repostedByViewer: boolean;
  createdAt: string;
  boostMultiplier: number;
  isBoosted: boolean;
  badgeType: "none" | "verified" | "gold";
}): number {
  const likesWeight = input.likesCount * 3;
  const commentsWeight = input.commentsCount * 5;
  const repostsWeight = input.repostsCount * 7;
  const followsWeight = input.followersCount * 0.55;
  const ageHours = hoursSince(input.createdAt);
  const recencyBoost = Math.max(2.8 - ageHours / 8, 0);

  let comboMultiplier = 1;
  if (input.likesCount >= 3 && input.commentsCount >= 2) comboMultiplier += 0.2;
  if (input.likesCount >= 5 && input.commentsCount >= 3 && input.repostsCount >= 1) comboMultiplier += 0.25;
  if (input.likesCount >= 8 && input.commentsCount >= 5 && input.repostsCount >= 2 && input.followersCount >= 10) {
    comboMultiplier += 0.35;
  }

  const viewerAffinityBoost =
    (input.isFollowedByViewer ? 2.5 : 0) +
    (input.likedByViewer ? 1.25 : 0) +
    (input.repostedByViewer ? 2 : 0);
  const boostedPriority = input.isBoosted ? 12 : 0;
  const badgePriority = input.badgeType === "gold" ? 8 : input.badgeType === "verified" ? 4 : 0;

  const baseScore =
    (likesWeight + commentsWeight + repostsWeight + followsWeight) * comboMultiplier +
    recencyBoost +
    viewerAffinityBoost +
    boostedPriority +
    badgePriority;
  return baseScore * Math.max(input.boostMultiplier, 1);
}

function parseBoostMetadata(output: Record<string, unknown>): BoostMetadata | null {
  const outputRecord = asRecord(output);
  const extra = asRecord(outputRecord.extra);
  const distribution = asRecord(extra.distribution);
  const boost = asRecord(distribution.boost);

  const userId = asString(boost.userId).trim();
  const boostedAt = asString(boost.boostedAt).trim();
  const activeUntil = asString(boost.activeUntil).trim();
  const multiplierValue = Number(boost.multiplier ?? boost.boostMultiplier ?? 1);
  const multiplier = Number.isFinite(multiplierValue) ? multiplierValue : 1;

  if (!userId || !boostedAt || !activeUntil || multiplier <= 1) return null;
  return { userId, multiplier, boostedAt, activeUntil };
}

function extractFeedItem(row: GenerationRow, currentUserId: string): FeedItem | null {
  if (!isEligibleFeedPost(row)) {
    return null;
  }

  const input = asRecord(row.input);
  const output = asRecord(row.output);
  const extra = asRecord(output.extra);
  const distribution = getDistribution(output);
  const businessContext = asRecord(extra.businessContext);
  const prompt = asString(input.prompt).trim();
  const text = asString(output.text).trim();
  const brandName =
    asString(extra.brandName).trim() ||
    asString(businessContext.businessName).trim() ||
    "Wovo Brand";

  return {
    id: row.id,
    createdAt: row.created_at,
    module: asString(input.module).trim() || "ad_studio",
    prompt,
    text,
    image: asString(output.image).trim() || null,
    video: asString(output.video).trim() || null,
    brandName,
    channels: distribution.channels,
    isMine: row.user_id === currentUserId,
    likesCount: 0,
    commentsCount: 0,
    repostsCount: 0,
    likedByViewer: false,
    repostedByViewer: false,
    isBoosted: false,
    boostMultiplier: 1,
    boostedUntil: null,
    author: {
      userId: row.user_id,
      username: "",
      displayName: brandName,
      avatarUrl: null,
      bio: null,
      followersCount: 0,
      isFollowedByViewer: false,
      isVerified: false,
      badgeType: "none",
    },
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
      "/rest/v1/generations?select=id,user_id,input,output,created_at&order=created_at.desc&limit=120"
    );

    const baseFeed = (rows ?? [])
      .map((row) => extractFeedItem(row, user.id))
      .filter((item): item is FeedItem => Boolean(item));

    const boostByPostId = new Map<string, BoostMetadata>();
    for (const row of rows ?? []) {
      const boost = parseBoostMetadata(asRecord(row.output));
      if (!boost) continue;
      boostByPostId.set(row.id, boost);
    }

    if (baseFeed.length === 0) {
      return NextResponse.json({ feed: [] });
    }

    const postIds = baseFeed.map((post) => post.id);
    const authorIds = Array.from(new Set([...baseFeed.map((post) => post.author.userId), user.id]));
    const encodedPostIn = encodeURIComponent(`(${postIds.join(",")})`);
    const encodedAuthorIn = encodeURIComponent(`(${authorIds.join(",")})`);

    const [profiles, likesRows, commentsRows, repostRows, followSummary, viewerRows, badgeMap, moderationMap] = await Promise.all([
      supabaseServiceRoleRequest<
        Array<{
          user_id: string;
          username: string | null;
          full_name: string | null;
        }>
      >(`/rest/v1/profiles?select=user_id,username,full_name&user_id=in.${encodedAuthorIn}`),
      supabaseServiceRoleRequest<Array<{ post_id: string; user_id: string }>>(
        `/rest/v1/post_likes?select=post_id,user_id&post_id=in.${encodedPostIn}`
      ).catch((error) => {
        if (isMissingPostLikesTableError(error)) return null;
        throw error;
      }),
      supabaseServiceRoleRequest<Array<{ post_id: string }>>(
        `/rest/v1/post_comments?select=post_id&post_id=in.${encodedPostIn}`
      ).catch((error) => {
        if (isMissingPostCommentsTableError(error)) return null;
        throw error;
      }),
      supabaseServiceRoleRequest<Array<{ post_id: string; user_id: string }>>(
        `/rest/v1/post_reposts?select=post_id,user_id&post_id=in.${encodedPostIn}`
      ).catch((error) => {
        if (isMissingPostRepostsTableError(error)) return null;
        throw error;
      }),
      resolveFollowSummary(user.id, authorIds),
      supabaseServiceRoleRequest<Array<{ id: string; output: Record<string, unknown>; created_at: string }>>(
        `/rest/v1/generations?select=id,output,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=260`
      ).catch(() => []),
      resolveBadgeMapForUsers(authorIds),
      getModerationStateMapForUsers(authorIds),
    ]);

    const useFallbackLikes = likesRows === null;
    const useFallbackComments = commentsRows === null;
    const useFallbackReposts = repostRows === null;
    const fallbackEngagement =
      useFallbackLikes || useFallbackComments || useFallbackReposts
        ? await resolveFallbackEngagementSummary(postIds, user.id)
        : null;

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const likesByPost = new Map<string, number>();
    const likedByViewer = new Set<string>();
    for (const like of likesRows ?? []) {
      likesByPost.set(like.post_id, (likesByPost.get(like.post_id) ?? 0) + 1);
      if (like.user_id === user.id) {
        likedByViewer.add(like.post_id);
      }
    }
    if (useFallbackLikes && fallbackEngagement) {
      for (const postId of postIds) {
        likesByPost.set(postId, fallbackEngagement.likesCountByPost.get(postId) ?? 0);
        if (fallbackEngagement.likedByViewerPostIds.has(postId)) {
          likedByViewer.add(postId);
        }
      }
    }

    const commentsByPost = new Map<string, number>();
    for (const comment of commentsRows ?? []) {
      commentsByPost.set(comment.post_id, (commentsByPost.get(comment.post_id) ?? 0) + 1);
    }
    if (useFallbackComments && fallbackEngagement) {
      for (const postId of postIds) {
        commentsByPost.set(postId, fallbackEngagement.commentsCountByPost.get(postId) ?? 0);
      }
    }

    const repostsByPost = new Map<string, number>();
    const repostedByViewer = new Set<string>();
    for (const repost of repostRows ?? []) {
      repostsByPost.set(repost.post_id, (repostsByPost.get(repost.post_id) ?? 0) + 1);
      if (repost.user_id === user.id) {
        repostedByViewer.add(repost.post_id);
      }
    }
    if (useFallbackReposts && fallbackEngagement) {
      for (const postId of postIds) {
        repostsByPost.set(postId, fallbackEngagement.repostsCountByPost.get(postId) ?? 0);
        if (fallbackEngagement.repostedByViewerPostIds.has(postId)) {
          repostedByViewer.add(postId);
        }
      }
    }

    const followedAuthorIds = followSummary.followedByViewer;
    const followersCountByAuthor = followSummary.followersCountByUser;

    const nowMs = Date.now();
    let viewerLatestBoostAtMs = Number.NaN;
    let viewerLatestBoostPostId: string | null = null;
    let viewerLatestBoostMultiplier = 1.5;
    for (const row of viewerRows ?? []) {
      const boost = parseBoostMetadata(row.output);
      if (!boost || boost.userId !== user.id) continue;
      const boostedAtMs = Date.parse(boost.boostedAt);
      if (Number.isNaN(boostedAtMs)) continue;
      if (Number.isNaN(viewerLatestBoostAtMs) || boostedAtMs > viewerLatestBoostAtMs) {
        viewerLatestBoostAtMs = boostedAtMs;
        viewerLatestBoostPostId = row.id;
        viewerLatestBoostMultiplier = boost.multiplier;
      }
    }
    const viewerCooldownEndsAt = Number.isNaN(viewerLatestBoostAtMs)
      ? null
      : new Date(viewerLatestBoostAtMs + 3 * 24 * 60 * 60 * 1000).toISOString();
    const viewerCanBoost = !viewerCooldownEndsAt || nowMs >= Date.parse(viewerCooldownEndsAt);
    const viewerBadgeType = badgeMap.get(user.id) ?? "none";
    const viewerIsVerified = viewerBadgeType !== "none";
    const viewerBoostState: ViewerBoostInfo = {
      isVerified: viewerIsVerified,
      canBoost: viewerIsVerified && viewerCanBoost,
      cooldownEndsAt: viewerCanBoost ? null : viewerCooldownEndsAt,
      activePostId: viewerLatestBoostPostId,
      boostMultiplier: Number.isFinite(viewerLatestBoostMultiplier) && viewerLatestBoostMultiplier > 1
        ? viewerLatestBoostMultiplier
        : 1.5,
    };

    const feed = baseFeed
      .map((post): FeedItem | null => {
        const moderationState = moderationMap.get(post.author.userId);
        if (moderationState?.banned) return null;

      const profile = profileMap.get(post.author.userId);
      const username = asString(profile?.username).trim();
      const displayName = asString(profile?.full_name).trim() || post.brandName;
      const followersCount = followersCountByAuthor.get(post.author.userId) ?? 0;
      const isFollowedByViewer = followedAuthorIds.has(post.author.userId);
      const likesCount = likesByPost.get(post.id) ?? 0;
      const commentsCount = commentsByPost.get(post.id) ?? 0;
      const repostsCount = repostsByPost.get(post.id) ?? 0;
      const likedViewer = likedByViewer.has(post.id);
      const repostedViewer = repostedByViewer.has(post.id);
      const boost = boostByPostId.get(post.id) ?? null;
      const boostActiveUntilMs = boost?.activeUntil ? Date.parse(boost.activeUntil) : Number.NaN;
      const badgeType = badgeMap.get(post.author.userId) ?? "none";
      const boostAllowed =
        Boolean(boost) &&
        badgeType !== "none" &&
        boost!.userId === post.author.userId &&
        !Number.isNaN(boostActiveUntilMs) &&
        boostActiveUntilMs > nowMs;
      const boostMultiplier = boostAllowed ? Math.max(boost?.multiplier ?? 1, 1) : 1;
      const boostedUntil = boostAllowed ? (boost?.activeUntil ?? null) : null;

      return {
        ...post,
        likesCount,
        commentsCount,
        repostsCount,
        likedByViewer: likedViewer,
        repostedByViewer: repostedViewer,
        isBoosted: boostMultiplier > 1,
        boostMultiplier,
        boostedUntil,
        author: {
          userId: post.author.userId,
          username: username || `brand_${post.author.userId.slice(0, 8)}`,
          displayName,
          avatarUrl: null,
          bio: null,
          followersCount,
          isFollowedByViewer,
          isVerified: badgeType !== "none",
          badgeType,
        },
      };
      })
      .filter((post): post is FeedItem => Boolean(post));

    const rankedFeed = feed
      .sort((a, b) => {
        const priorityA =
          (a.isBoosted ? 4 : 0) +
          (a.author.badgeType === "gold" ? 2 : a.author.badgeType === "verified" ? 1 : 0);
        const priorityB =
          (b.isBoosted ? 4 : 0) +
          (b.author.badgeType === "gold" ? 2 : b.author.badgeType === "verified" ? 1 : 0);
        if (priorityB !== priorityA) return priorityB - priorityA;

        const scoreA = computeRankingScore({
          likesCount: a.likesCount,
          commentsCount: a.commentsCount,
          repostsCount: a.repostsCount,
          followersCount: a.author.followersCount,
          isFollowedByViewer: a.author.isFollowedByViewer,
          likedByViewer: a.likedByViewer,
          repostedByViewer: a.repostedByViewer,
          createdAt: a.createdAt,
          boostMultiplier: a.boostMultiplier,
          isBoosted: a.isBoosted,
          badgeType: a.author.badgeType,
        });
        const scoreB = computeRankingScore({
          likesCount: b.likesCount,
          commentsCount: b.commentsCount,
          repostsCount: b.repostsCount,
          followersCount: b.author.followersCount,
          isFollowedByViewer: b.author.isFollowedByViewer,
          likedByViewer: b.likedByViewer,
          repostedByViewer: b.repostedByViewer,
          createdAt: b.createdAt,
          boostMultiplier: b.boostMultiplier,
          isBoosted: b.isBoosted,
          badgeType: b.author.badgeType,
        });
        if (scoreB !== scoreA) return scoreB - scoreA;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });

    return NextResponse.json({ feed: rankedFeed, boost: viewerBoostState });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load feed." },
      { status: 500 },
    );
  }
}
