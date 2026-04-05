import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, getDistribution, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import { resolveBadgeMapForUsers } from "@/lib/wovo-ai/badges";
import { getModerationStateMapForUsers } from "@/lib/wovo-ai/moderation";
import { resolveFollowSummary } from "@/lib/wovo-ai/follows";

type DiscoverProfileRow = {
  user_id: string;
  username: string | null;
  full_name?: string | null;
  email?: string | null;
};

type GenerationRow = {
  id: string;
  user_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

type CreatorCard = {
  userId: string;
  username: string;
  displayName: string;
  followersCount: number;
  postsCount: number;
  isFollowedByViewer: boolean;
  isVerified: boolean;
  badgeType: "none" | "verified" | "gold";
  latestPost: {
    id: string;
    createdAt: string;
    module: string;
    text: string;
    image: string | null;
    video: string | null;
    shareToFeed: boolean;
  } | null;
};

const PROFILE_SELECT_CANDIDATES = [
  { select: "user_id,username,full_name,email,updated_at", order: "updated_at.desc", usernameFilter: true },
  { select: "user_id,username,full_name,email", order: "user_id.asc", usernameFilter: true },
  { select: "user_id,username,full_name,email", order: "user_id.asc", usernameFilter: false },
  { select: "user_id,full_name,email", order: "user_id.asc", usernameFilter: false },
];

function shouldRetryProfileQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column") && message.includes("profiles") && message.includes("schema cache")) ||
    (message.includes("permission denied") && message.includes("profiles"))
  );
}

function normalizeSearchQuery(value: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.\-\s]/g, "")
    .slice(0, 40);
}

function toSearchScore(profile: DiscoverProfileRow, query: string): number {
  if (!query) return 0;
  const username = (profile.username ?? "").toLowerCase();
  const fullName = (profile.full_name ?? "").toLowerCase();
  if (username === query) return 120;
  if (username.startsWith(query)) return 90;
  if (fullName.startsWith(query)) return 65;
  if (username.includes(query)) return 45;
  if (fullName.includes(query)) return 25;
  return 0;
}

function asNullableMedia(value: unknown): string | null {
  const text = asString(value).trim();
  return text || null;
}

function extractLatestPost(row: GenerationRow): CreatorCard["latestPost"] {
  const input = asRecord(row.input);
  const output = asRecord(row.output);
  const distribution = getDistribution(output);

  return {
    id: row.id,
    createdAt: row.created_at,
    module: asString(input.module).trim() || "ad_studio",
    text: asString(output.text).trim(),
    image: asNullableMedia(output.image),
    video: asNullableMedia(output.video),
    shareToFeed: distribution.shareToFeed,
  };
}

async function loadDiscoverProfiles(limit: number): Promise<DiscoverProfileRow[]> {
  let lastError: unknown = null;
  for (const candidate of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<DiscoverProfileRow[]>(
        `/rest/v1/profiles?select=${candidate.select}${candidate.usernameFilter ? "&username=not.is.null" : ""}&order=${candidate.order}&limit=${limit}`,
      );
      return rows ?? [];
    } catch (error) {
      lastError = error;
      if (shouldRetryProfileQuery(error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

function fallbackUsernameForRow(row: DiscoverProfileRow): string {
  const localEmail = asString(row.email).trim().split("@")[0] ?? "";
  const fullName = asString(row.full_name).trim();
  const fallbackSeed = fullName || localEmail || `brand_${row.user_id.slice(0, 8)}`;
  try {
    const normalized = normalizeUsername(fallbackSeed);
    if (normalized) return normalized;
  } catch {
    // fallback below
  }
  return `brand_${row.user_id.slice(0, 8)}`;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const url = new URL(request.url);
    const query = normalizeSearchQuery(url.searchParams.get("q"));
    const limitRaw = Number(url.searchParams.get("limit") ?? "18");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.round(limitRaw), 1), 40) : 18;

    const loadedProfiles = await loadDiscoverProfiles(250);
    const dedupedProfiles = new Map<string, DiscoverProfileRow>();
    for (const row of loadedProfiles) {
      if (!row?.user_id) continue;
      let normalizedUsername = "";
      try {
        normalizedUsername = normalizeUsername(row.username ?? "");
      } catch {
        normalizedUsername = "";
      }
      if (!normalizedUsername) {
        normalizedUsername = fallbackUsernameForRow(row);
      }
      if (!dedupedProfiles.has(row.user_id)) {
        dedupedProfiles.set(row.user_id, {
          ...row,
          username: normalizedUsername,
        });
      }
    }

    const filtered = Array.from(dedupedProfiles.values())
      .filter((row) => {
        if (!query) return true;
        const username = (row.username ?? "").toLowerCase();
        const fullName = (row.full_name ?? "").toLowerCase();
        return username.includes(query) || fullName.includes(query);
      })
      .sort((a, b) => toSearchScore(b, query) - toSearchScore(a, query))
      .slice(0, limit);

    if (filtered.length === 0) {
      return NextResponse.json({ creators: [] });
    }

    const userIds = filtered.map((row) => row.user_id);
    const encodedUserIn = encodeURIComponent(`(${userIds.join(",")})`);

    const [followSummary, generationRows] = await Promise.all([
      resolveFollowSummary(user.id, userIds),
      supabaseServiceRoleRequest<GenerationRow[]>(
        `/rest/v1/generations?select=id,user_id,input,output,created_at&user_id=in.${encodedUserIn}&order=created_at.desc&limit=800`,
      ).catch(() => []),
    ]);

    const followedByViewer = followSummary.followedByViewer;
    const followersCountByUser = followSummary.followersCountByUser;

    const postsCountByUser = new Map<string, number>();
    const latestPostByUser = new Map<string, CreatorCard["latestPost"]>();
    for (const row of generationRows ?? []) {
      if (!isEligibleFeedPost(row)) continue;
      postsCountByUser.set(row.user_id, (postsCountByUser.get(row.user_id) ?? 0) + 1);
      if (!latestPostByUser.has(row.user_id)) {
        latestPostByUser.set(row.user_id, extractLatestPost(row));
      }
    }

    const [badgeMap, moderationMap] = await Promise.all([
      resolveBadgeMapForUsers(userIds),
      getModerationStateMapForUsers(userIds),
    ]);

    const creators = filtered
      .map((row) => {
        const moderationState = moderationMap.get(row.user_id);
        if (moderationState?.banned) return null;

        let username = "";
        try {
          username = normalizeUsername(row.username ?? "");
        } catch {
          username = "";
        }
        if (!username) return null;
        const badgeType = badgeMap.get(row.user_id) ?? "none";
        return {
          userId: row.user_id,
          username,
          displayName: (row.full_name ?? "").trim() || `@${username}`,
          followersCount: followersCountByUser.get(row.user_id) ?? 0,
          postsCount: postsCountByUser.get(row.user_id) ?? 0,
          isFollowedByViewer: followedByViewer.has(row.user_id),
          isVerified: badgeType !== "none",
          badgeType,
          latestPost: latestPostByUser.get(row.user_id) ?? null,
        } satisfies CreatorCard;
      })
      .filter((row): row is CreatorCard => Boolean(row))
      .sort((a, b) => {
        if (query) {
          const scoreDiff =
            toSearchScore({ user_id: b.userId, username: b.username, full_name: b.displayName }, query) -
            toSearchScore({ user_id: a.userId, username: a.username, full_name: a.displayName }, query);
          if (scoreDiff !== 0) return scoreDiff;
        }
        if (b.postsCount !== a.postsCount) return b.postsCount - a.postsCount;
        if (b.followersCount !== a.followersCount) return b.followersCount - a.followersCount;
        return a.username.localeCompare(b.username);
      });

    return NextResponse.json({ creators });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load creator discovery." },
      { status: 500 },
    );
  }
}
