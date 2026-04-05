import { NextResponse } from "next/server";
import { listAuthAdminUsers, requireServerUser, type AuthUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/wovo-ai/profile-utils";
import { resolveEffectiveRole, resolveUserEmail } from "@/lib/wovo-ai/admin";

type ProfileRow = {
  user_id: string;
  username: string | null;
  full_name?: string | null;
  email?: string | null;
};

const PROFILE_SELECT_CANDIDATES = [
  "user_id,username,full_name,email,updated_at",
  "user_id,username,full_name,email",
  "user_id,username,full_name",
  "user_id,username",
  "user_id",
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

function readRoleCandidate(user: AuthUser): string | null {
  const appRole = typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null;
  const userRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
  return appRole ?? userRole;
}

function fallbackUsername(seed: string): string {
  try {
    const normalized = normalizeUsername(seed);
    if (normalized) return normalized;
  } catch {
    // ignore and fallback
  }
  return `brand_${seed.slice(0, 8)}`;
}

async function listAdminAuthUsers(): Promise<AuthUser[]> {
  const perPage = 200;
  const results: AuthUser[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const rows = await listAuthAdminUsers({ page, perPage }).catch(() => []);
    results.push(...rows);
    if (rows.length < perPage) break;
  }

  const deduped = new Map<string, AuthUser>();
  for (const user of results) {
    if (!user.id) continue;
    if (!deduped.has(user.id)) deduped.set(user.id, user);
  }

  return Array.from(deduped.values()).filter((user) => {
    const email = resolveUserEmail(user);
    const role = readRoleCandidate(user);
    return resolveEffectiveRole({ role, email }) === "admin";
  });
}

async function loadProfiles(userIds: string[]): Promise<ProfileRow[]> {
  if (userIds.length === 0) return [];
  const encodedIn = encodeURIComponent(`(${userIds.join(",")})`);
  let lastError: unknown = null;
  for (const select of PROFILE_SELECT_CANDIDATES) {
    try {
      const rows = await supabaseServiceRoleRequest<ProfileRow[]>(
        `/rest/v1/profiles?select=${select}&user_id=in.${encodedIn}&limit=${userIds.length}`,
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

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const viewerEmail = resolveUserEmail(user);
    const viewerRole = readRoleCandidate(user);
    const viewerIsAdmin = resolveEffectiveRole({ role: viewerRole, email: viewerEmail }) === "admin";
    const adminUsers = await listAdminAuthUsers();
    const profileRows = await loadProfiles(adminUsers.map((row) => row.id));
    const profileMap = new Map(profileRows.map((row) => [row.user_id, row]));

    const admins = adminUsers.map((adminUser) => {
      const profile = profileMap.get(adminUser.id);
      const email = resolveUserEmail(adminUser) ?? profile?.email ?? "";
      const username = fallbackUsername((profile?.username ?? email) || adminUser.id);
      const displayName = (profile?.full_name ?? "").trim() || `@${username}`;
      return {
        userId: adminUser.id,
        username,
        displayName,
      };
    });

    return NextResponse.json({
      admins,
      viewer: {
        userId: user.id,
        isAdmin: viewerIsAdmin,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load support admins." },
      { status: 500 },
    );
  }
}
