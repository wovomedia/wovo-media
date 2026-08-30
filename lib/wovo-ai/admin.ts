function getAdminProEmails(): string[] {
  const envEmails = [
    process.env.ADMIN_EMAILS,
    process.env.WOVO_ADMIN_EMAILS,
    process.env.WOVO_OWNER_EMAIL,
    process.env.WOVO_OWNER_EMAILS,
  ]
    .filter((value): value is string => Boolean(value))
    .join(",")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(envEmails));
}

export function isAdminProEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminProEmails().includes(email.trim().toLowerCase());
}

export function isAdminEmail(email: string | undefined | null): boolean {
  return isAdminProEmail(email);
}

export function normalizeRole(value: unknown): "admin" | "user" {
  return typeof value === "string" && value.trim().toLowerCase() === "admin" ? "admin" : "user";
}

export function resolveTrustedAuthRole(
  user?: { app_metadata?: Record<string, unknown> | null } | null,
): "admin" | "user" {
  return normalizeRole(user?.app_metadata?.role);
}

export function resolveRoleForEmail(email?: string | null): "admin" | "user" {
  return isAdminProEmail(email) ? "admin" : "user";
}

export function resolveEffectiveRole(input: { role?: unknown; email?: string | null }): "admin" | "user" {
  return normalizeRole(input.role) === "admin" || resolveRoleForEmail(input.email) === "admin" ? "admin" : "user";
}

export function resolveUserEmail(user?: { email?: string | null } | null): string | null {
  const direct = user?.email?.trim().toLowerCase();
  return direct || null;
}
