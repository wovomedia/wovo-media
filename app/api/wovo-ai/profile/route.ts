import { NextResponse } from "next/server";
import {
  requireServerUser,
  supabaseServiceRoleRequest,
  updateAuthEmail,
  updateAuthUserMetadata,
  updateAuthUserMetadataById,
} from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/wovo-ai/profile-bootstrap";
import { normalizeRole, resolveEffectiveRole, resolveRoleForEmail, resolveUserEmail } from "@/lib/wovo-ai/admin";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import { resolveBadgeForUser } from "@/lib/wovo-ai/badges";
import { getModerationStateForUser } from "@/lib/wovo-ai/moderation";
import { resolveProfileFollowStats } from "@/lib/wovo-ai/follows";

type ProfilePayload = {
  user_id?: string;
  email?: string;
  full_name?: string;
  username?: string;
  bio?: string;
  business_name?: string;
  business_type?: string;
  location?: string;
  contact?: string;
  topic?: string;
  goal?: string;
  avatar_url?: string;
  monthly_limit?: number | null;
  monthly_used?: number | null;
  extra_credits?: number | null;
  plan?: string | null;
  enforce_profile_completion?: boolean;
};

const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const PROFILE_SELECT_CANDIDATES = [
  "user_id,email,full_name,username,bio,business_name,business_type,location,contact,topic,goal,monthly_limit,monthly_used,extra_credits,plan",
  "user_id,email,full_name,username,business_name,business_type,location,contact,topic,goal,monthly_limit,monthly_used,extra_credits,plan",
  "user_id,email,full_name,username,bio,monthly_limit,monthly_used,extra_credits,plan",
  "user_id,email,full_name,username,monthly_limit,monthly_used,extra_credits,plan",
  "user_id,email,full_name,username,bio,plan",
  "user_id,email,full_name,username,plan",
  "user_id,email,full_name,username,bio",
  "user_id,email,full_name,username",
  "user_id,email,full_name",
];

function normalizeOptionalText(input: string | null | undefined): string | null {
  const normalized = (input ?? "").trim();
  return normalized || null;
}

function mergeTextField(incoming: string | null | undefined, existing: string | null | undefined): string | null {
  if (incoming === undefined) {
    return normalizeOptionalText(existing);
  }
  return normalizeOptionalText(incoming);
}

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

function isMissingProfileColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column profiles.") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("column") && message.includes("profiles") && message.includes("schema cache"))
  );
}

function shouldRetryProfileQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    isMissingProfileColumnError(error) ||
    (message.includes("permission denied") && message.includes("profiles"))
  );
}

async function fetchProfileRow(userId: string): Promise<ProfilePayload | null> {
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfilePayload[]>(
        `/rest/v1/profiles?select=${select}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
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
  if (lastError && !shouldRetryProfileQuery(lastError)) throw lastError;
  return null;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const resolvedUserEmail = resolveUserEmail(user);
    let metadataUsername = "";
    try {
      metadataUsername = normalizeUsername(
        typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "",
      );
    } catch {
      metadataUsername = "";
    }
    const authAvatarUrl = normalizeOptionalText(
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : typeof user.user_metadata?.picture === "string"
          ? user.user_metadata.picture
          : null,
    );
    try {
      await ensureProfileForUser(user);
    } catch {
      // Bootstrap is best-effort. Profile reads should still work.
    }
    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("user_id")?.trim();
    const targetUserId = queryUserId || user.id;
    const isOwnProfile = targetUserId === user.id;

    const profile = await fetchProfileRow(targetUserId);
    let profileUsername = "";
    try {
      profileUsername = normalizeUsername(profile?.username ?? "");
    } catch {
      profileUsername = "";
    }
    const resolvedUsername = profileUsername || (isOwnProfile ? metadataUsername : "");

    let userRoleFromTable: string | null = null;
    try {
      const userRows = await supabaseServiceRoleRequest<Array<{ role: string | null }>>(
        `/rest/v1/users?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      );
      userRoleFromTable = userRows?.[0]?.role ?? null;
    } catch {
      userRoleFromTable = null;
    }
    const metadataRole =
      (typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null) ??
      (typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null);

    const role = resolveEffectiveRole({
      role: normalizeRole(userRoleFromTable ?? metadataRole),
      email: profile?.email ?? resolvedUserEmail,
    });
    const profileComplete = Boolean((profile?.full_name ?? "").trim() && resolvedUsername);
    const creditsRemaining = Math.max(
      (profile?.monthly_limit ?? 0) + (profile?.extra_credits ?? 0) - (profile?.monthly_used ?? 0),
      0,
    );

    let followersCount = 0;
    let followingCount = 0;
    let isFollowing = false;
    let verifiedBadgeStatus: string | null = null;
    let verifiedBadgeCancelAtPeriodEnd = false;
    try {
      const followStats = await resolveProfileFollowStats(user.id, targetUserId, isOwnProfile);
      followersCount = followStats.followersCount;
      followingCount = followStats.followingCount;
      isFollowing = followStats.isFollowing;
    } catch {
      followersCount = 0;
      followingCount = 0;
      isFollowing = false;
      verifiedBadgeStatus = null;
      verifiedBadgeCancelAtPeriodEnd = false;
    }

    const moderation = await getModerationStateForUser(targetUserId).catch(() => ({ banned: false, feedPostingDisabled: false }));
    if (moderation.banned && !isOwnProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const badgeKind = await resolveBadgeForUser(targetUserId).catch(() => "none");
    const verifiedBadgeActive = badgeKind !== "none";
    verifiedBadgeStatus = badgeKind === "none" ? null : badgeKind === "gold" ? "admin" : "active";
    verifiedBadgeCancelAtPeriodEnd = false;

    return NextResponse.json(
      profile
        ? {
            ...profile,
            username: resolvedUsername || profile?.username || null,
            avatar_url: isOwnProfile ? authAvatarUrl : null,
            role,
            is_own_profile: isOwnProfile,
            followers_count: followersCount,
            following_count: followingCount,
            is_following: isFollowing,
            subscription_tier: profile.plan ?? "none",
            credits_remaining: creditsRemaining,
            profile_complete: profileComplete,
            verified_badge_active: verifiedBadgeActive,
            verified_badge_status: verifiedBadgeStatus,
            verified_badge_cancel_at_period_end: verifiedBadgeCancelAtPeriodEnd,
            badge_type: badgeKind,
            moderation,
          }
        : {
            role,
            user_id: targetUserId,
            username: isOwnProfile ? metadataUsername || null : null,
            avatar_url: isOwnProfile ? authAvatarUrl : null,
            is_own_profile: isOwnProfile,
            followers_count: followersCount,
            following_count: followingCount,
            is_following: isFollowing,
            subscription_tier: "none",
            credits_remaining: 0,
            profile_complete: false,
            verified_badge_active: verifiedBadgeActive,
            verified_badge_status: verifiedBadgeStatus,
            verified_badge_cancel_at_period_end: verifiedBadgeCancelAtPeriodEnd,
            badge_type: badgeKind,
            moderation,
          },
    );
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } = await requireServerUser(request.headers.get("authorization"));
    const resolvedUserEmail = resolveUserEmail(user);
    try {
      await ensureProfileForUser(user);
    } catch {
      // Bootstrap is best-effort. Profile writes should still run.
    }
    let body: ProfilePayload = {};
    const rawBody = await request.text();
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as ProfilePayload;
      } catch {
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
      }
    }
    const existingProfile = await fetchProfileRow(user.id);

    const normalizedEmail = body.email?.trim().toLowerCase() ?? "";
    const existingEmail = existingProfile?.email?.trim().toLowerCase() ?? "";
    const resolvedEmail = normalizedEmail || existingEmail || resolvedUserEmail || null;
    const resolvedRole = resolveRoleForEmail(resolvedEmail);
    const fullName = mergeTextField(body.full_name, existingProfile?.full_name);
    let metadataUsernameNormalized = "";
    try {
      metadataUsernameNormalized = normalizeUsername(
        typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "",
      );
    } catch {
      metadataUsernameNormalized = "";
    }
    let existingUsernameNormalized = "";
    try {
      existingUsernameNormalized = normalizeUsername(existingProfile?.username ?? "");
    } catch {
      existingUsernameNormalized = (existingProfile?.username ?? "").trim().toLowerCase().replace(/^@+/, "");
    }
    if (!existingUsernameNormalized && metadataUsernameNormalized) {
      existingUsernameNormalized = metadataUsernameNormalized;
    }
    const normalizedUsername = normalizeUsername(body.username ?? existingProfile?.username ?? metadataUsernameNormalized);
    const normalizedBio = mergeTextField(body.bio, existingProfile?.bio)?.slice(0, 280) ?? null;
    const enforceProfileCompletion = body.enforce_profile_completion === true;
    const usernameHasChanged = normalizedUsername !== existingUsernameNormalized;
    const usernameLastChangedAt = parseDateValue(user.user_metadata?.username_last_changed_at);

    if (normalizedUsername) {
      try {
        const existingUsernameRows = await supabaseServiceRoleRequest<Array<{ user_id: string }>>(
          `/rest/v1/profiles?select=user_id&username=eq.${encodeURIComponent(normalizedUsername)}&user_id=neq.${encodeURIComponent(user.id)}&limit=1`,
        );
        if (existingUsernameRows?.length) {
          return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
        }
      } catch (error) {
        if (!shouldRetryProfileQuery(error)) throw error;
      }
    }

    if (usernameHasChanged && usernameLastChangedAt) {
      const nextAllowedAt = new Date(usernameLastChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS);
      if (Date.now() < nextAllowedAt.getTime()) {
        const nextAllowedLabel = nextAllowedAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        return NextResponse.json(
          {
            error: `Username changes are limited to once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. You can change it again on ${nextAllowedLabel}.`,
          },
          { status: 429 },
        );
      }
    }

    if (enforceProfileCompletion) {
      if (!fullName) {
        return NextResponse.json({ error: "Full name is required." }, { status: 400 });
      }
      if (!normalizedUsername) {
        return NextResponse.json({ error: "Username is required." }, { status: 400 });
      }
    }

    if (normalizedEmail && normalizedEmail !== (resolvedUserEmail ?? "").toLowerCase()) {
      await updateAuthEmail(accessToken, normalizedEmail);
    }

    const profileCorePatch = {
      user_id: user.id,
      email: resolvedEmail ?? null,
      full_name: fullName ?? null,
      username: normalizedUsername || null,
      updated_at: new Date().toISOString(),
    };
    const profileWithBioPatch = {
      ...profileCorePatch,
      bio: normalizedBio || null,
    };
    const profileExtendedPatch = {
      ...profileWithBioPatch,
      business_name: mergeTextField(body.business_name, existingProfile?.business_name),
      business_type: mergeTextField(body.business_type, existingProfile?.business_type),
      location: mergeTextField(body.location, existingProfile?.location),
      contact: mergeTextField(body.contact, existingProfile?.contact),
      topic: mergeTextField(body.topic, existingProfile?.topic),
      goal: mergeTextField(body.goal, existingProfile?.goal),
    };

    const profileWriteCandidates: Array<Record<string, unknown>> = [
      profileExtendedPatch,
      profileWithBioPatch,
      profileCorePatch,
      {
        user_id: user.id,
        email: resolvedEmail ?? null,
        full_name: fullName ?? null,
        username: normalizedUsername || null,
      },
      {
        user_id: user.id,
        email: resolvedEmail ?? null,
        full_name: fullName ?? null,
      },
      {
        user_id: user.id,
        email: resolvedEmail ?? null,
      },
      {
        user_id: user.id,
      },
    ];

    let writeSucceeded = false;
    let lastWriteError: unknown = null;
    for (const candidate of profileWriteCandidates) {
      try {
        await supabaseServiceRoleRequest("/rest/v1/profiles?on_conflict=user_id", {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(candidate),
        });
        writeSucceeded = true;
        break;
      } catch (error) {
        lastWriteError = error;
        if (shouldRetryProfileQuery(error) || isMissingProfileColumnError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!writeSucceeded && lastWriteError) {
      throw lastWriteError;
    }

    try {
      await supabaseServiceRoleRequest("/rest/v1/users?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: user.id,
          email: resolvedEmail ?? "",
          role: resolvedRole,
          name: fullName || user.user_metadata?.full_name || user.user_metadata?.name || null,
        }),
      });
    } catch {
      // Keep profile updates resilient even if the public.users table is unavailable.
    }

    const shouldUpdateAvatarMetadata = body.avatar_url !== undefined;
    const shouldSyncUsernameMetadata = normalizedUsername !== metadataUsernameNormalized;
    if (usernameHasChanged || shouldUpdateAvatarMetadata || shouldSyncUsernameMetadata) {
      const nextUserMetadata: Record<string, unknown> = { ...(user.user_metadata ?? {}) };
      if (usernameHasChanged) {
        nextUserMetadata.username_last_changed_at = new Date().toISOString();
      }
      if (normalizedUsername) {
        nextUserMetadata.username = normalizedUsername;
      } else {
        delete nextUserMetadata.username;
      }
      if (shouldUpdateAvatarMetadata) {
        const normalizedAvatarUrl = normalizeOptionalText(body.avatar_url);
        if (normalizedAvatarUrl) {
          nextUserMetadata.avatar_url = normalizedAvatarUrl;
        } else {
          delete nextUserMetadata.avatar_url;
        }
      }

      try {
        await updateAuthUserMetadata(accessToken, nextUserMetadata);
      } catch {
        try {
          await updateAuthUserMetadataById(user.id, nextUserMetadata);
        } catch {
          // Metadata sync is best-effort. Profile save should still succeed.
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[wovo-ai/profile] request failed", error);
    if (error instanceof Error && error.message.includes("Username must be")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("profiles_username_unique_idx") || error.message.toLowerCase().includes("duplicate key value"))
    ) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
