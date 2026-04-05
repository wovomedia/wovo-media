export type ClientProfileSummary = {
  role?: "admin" | "user";
  subscription_tier?: string;
  credits_remaining?: number;
  full_name?: string;
  username?: string;
  bio?: string;
  email?: string;
  profile_complete?: boolean;
};

export async function fetchProfileSummary(accessToken: string): Promise<ClientProfileSummary | null> {
  const response = await fetch("/api/wovo-ai/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ClientProfileSummary;
}

export function isProfileSetupComplete(profile: ClientProfileSummary | null): boolean {
  if (!profile) return false;
  if (typeof profile.profile_complete === "boolean") {
    return profile.profile_complete;
  }
  return Boolean(profile.full_name?.trim() && profile.username?.trim());
}
