type ProfileIdentityFields = {
  full_name?: string | null;
  username?: string | null;
};

export function normalizeUsername(input: string | null | undefined): string {
  const normalized = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "");
  if (!normalized) return "";
  if (!/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/.test(normalized)) {
    throw new Error("Username must be 3-30 characters using letters, numbers, dots, dashes, or underscores.");
  }
  return normalized;
}

export function isProfileComplete(profile: ProfileIdentityFields | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.full_name?.trim() && profile.username?.trim());
}
