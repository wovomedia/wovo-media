import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { asRecord, asString, getDistribution, isEligibleFeedPost } from "@/lib/wovo-ai/feed-utils";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import { resolveBadgeForUser } from "@/lib/wovo-ai/badges";
import { getModerationStateForUser } from "@/lib/wovo-ai/moderation";
import { resolveProfileFollowStats } from "@/lib/wovo-ai/follows";

type ProfileRow = {
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

const PROFILE_SELECT_CANDIDATES = [
  "user_id,username,full_name,email,updated_at",
  "user_id,username,full_name,email",
  "user_id,username,full_name",
  "user_id,username",
  "user_id,full_name,email",
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

async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=${select}&username=eq.${encodeURIComponent(username)}&limit=1`,
      );
      return rows?.[0] ?? null;
    } catch (error) {
      lastError = error;
      if (shouldRetryProfileQuery(error)) {
        continue;
      }
      throw error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function parseFallbackBrandPrefix(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  const match = /^brand_([0-9a-f]{8})$/.exec(normalized);
  if (!match) return null;
  return match[1];
}

async function getProfileByUserIdPrefix(prefix: string): Promise<ProfileRow | null> {
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=${select}&user_id=like.${encodeURIComponent(`${prefix}*`)}&limit=1`,
      );
      return rows?.[0] ?? null;
    } catch (error) {
      lastError = error;
      if (shouldRetryProfileQuery(error)) {
        continue;
      }
      throw error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function resolveDisplayUsername(profile: ProfileRow | null, routeUsername: string): string {
  let normalized = "";
  try {
    normalized = normalizeUsername(profile?.username ?? "");
  } catch {
    normalized = "";
  }
  if (normalized) return normalized;
  return routeUsername;
}

function extractBrandName(input: Record<string, unknown>, output: Record<string, unknown>, fallbackName: string): string {
  const inputRecord = asRecord(input);
  const outputRecord = asRecord(output);
  const outputExtra = asRecord(outputRecord.extra);
  const businessContext = asRecord(outputExtra.businessContext);
  return (
    asString(outputExtra.brandName).trim() ||
    asString(businessContext.businessName).trim() ||
    asString(inputRecord.businessProfileName).trim() ||
    fallbackName
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const params = await context.params;
    let normalizedUsername = "";
    try {
      normalizedUsername = normalizeUsername(params.username);
    } catch {
      return NextResponse.json({ error: "Invalid username." }, { status: 400 });
    }

    if (!normalizedUsername) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    let profile = await getProfileByUsername(normalizedUsername);
    if (!profile) {
      const fallbackPrefix = parseFallbackBrandPrefix(normalizedUsername);
      if (fallbackPrefix) {
        profile = await getProfileByUserIdPrefix(fallbackPrefix);
      }
    }
    if (!profile?.user_id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const targetUserId = profile.user_id;
    const isOwnProfile = targetUserId === user.id;

    const [followStats, generationRows] = await Promise.all([
      resolveProfileFollowStats(user.id, targetUserId, isOwnProfile),
      supabaseServiceRoleRequest<GenerationRow[]>(
        `/rest/v1/generations?select=id,user_id,input,output,created_at&user_id=eq.${encodeURIComponent(targetUserId)}&order=created_at.desc&limit=160`,
      ).catch(() => []),
    ]);

    const moderation = await getModerationStateForUser(targetUserId).catch(() => ({ banned: false, feedPostingDisabled: false }));
    if (moderation.banned && !isOwnProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const badgeType = await resolveBadgeForUser(targetUserId).catch(() => "none");
    const isVerified = badgeType !== "none";

    const resolvedUsername = resolveDisplayUsername(profile, normalizedUsername);
    const displayName = (profile.full_name ?? "").trim() || `@${resolvedUsername}`;
    const posts = (generationRows ?? [])
      .filter((row) => isEligibleFeedPost(row))
      .map((row) => {
        const input = asRecord(row.input);
        const output = asRecord(row.output);
        const distribution = getDistribution(output);
        return {
          id: row.id,
          createdAt: row.created_at,
          module: asString(input.module).trim() || "ad_studio",
          prompt: asString(input.prompt).trim(),
          text: asString(output.text).trim(),
          image: asString(output.image).trim() || null,
          video: asString(output.video).trim() || null,
          brandName: extractBrandName(input, output, displayName),
          channels: distribution.channels,
          shareToFeed: distribution.shareToFeed,
        };
      });

    return NextResponse.json({
      profile: {
        userId: targetUserId,
        username: resolvedUsername,
        displayName,
        isOwnProfile,
        followersCount: followStats.followersCount,
        followingCount: followStats.followingCount,
        isFollowedByViewer: followStats.isFollowing,
        isVerified,
        badgeType,
      },
      posts,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load public profile." },
      { status: 500 },
    );
  }
}
