export function getAdminEmail(): string {
  return (process.env.WOVO_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmail = getAdminEmail();
  if (!adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail;
}
