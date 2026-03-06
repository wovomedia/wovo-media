export const ADMIN_PRO_EMAILS = ["payton@wovomedia.com"];

function getAdminProEmails(): string[] {
  const envEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...ADMIN_PRO_EMAILS, ...envEmails]));
}

export function isAdminProEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminProEmails().includes(normalized);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  return isAdminProEmail(email);
}
