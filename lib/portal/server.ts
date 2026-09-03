import { getEnv, getEnvAny } from "@/lib/env";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { PORTAL_STAFF_ROLES, type PortalStaffRole } from "@/lib/portal/types";

export type PortalContext = {
  user: { id: string; email?: string };
  mode: "client" | "staff";
  staffRole: PortalStaffRole | null;
};

type StaffRow = { role: string; active: boolean };
type MemberRow = { account_id: string; active: boolean };

function configuredAdminEmails(): Set<string> {
  return new Set(
    getEnvAny(["WOVO_ADMIN_EMAILS", "ADMIN_EMAILS", "WOVO_ADMIN_EMAIL"])
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function configuredOwnerEmails(): Set<string> {
  return new Set(
    getEnvAny(["WOVO_OWNER_EMAIL", "WOVO_OWNER_EMAILS"])
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function appMetadataRole(user: { app_metadata?: Record<string, unknown> }): PortalStaffRole | null {
  const candidate = typeof user.app_metadata?.wovo_portal_role === "string"
    ? user.app_metadata.wovo_portal_role
    : typeof user.app_metadata?.role === "string"
      ? user.app_metadata.role
      : "";
  return PORTAL_STAFF_ROLES.includes(candidate as PortalStaffRole) ? candidate as PortalStaffRole : null;
}

export async function requirePortalContext(authHeader: string | null): Promise<PortalContext> {
  const { user } = await requireServerUser(authHeader);
  if (!user.email_confirmed_at) {
    throw new PortalHttpError(403, "Verify your email address to open your workspace.");
  }
  const rows = await supabaseServiceRoleRequest<StaffRow[]>(
    `/rest/v1/wovo_portal_staff?select=role,active&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  ).catch(() => []);
  const row = rows?.[0];
  const storedRole = row?.active && PORTAL_STAFF_ROLES.includes(row.role as PortalStaffRole)
    ? row.role as PortalStaffRole
    : null;
  const metadataRole = appMetadataRole(user);
  const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
  const envOwner = configuredOwnerEmails().has(normalizedEmail);
  const envAdmin = configuredAdminEmails().has(normalizedEmail);
  const staffRole = envOwner ? "owner" : storedRole ?? metadataRole ?? (envAdmin ? "admin" : null);
  return {
    user: { id: user.id, email: user.email },
    mode: staffRole ? "staff" : "client",
    staffRole,
  };
}

export async function getPortalAccountIds(context: PortalContext): Promise<string[]> {
  if (context.mode === "staff") {
    if (context.staffRole === "owner") {
      const rows = await supabaseServiceRoleRequest<Array<{ id: string }>>(
        "/rest/v1/wovo_portal_accounts?select=id&order=created_at.desc&limit=250"
      ).catch(() => []);
      return (rows ?? []).map((row) => row.id);
    }
    const assigned = await supabaseServiceRoleRequest<Array<{ account_id: string }>>(
      `/rest/v1/wovo_portal_threads?select=account_id&assigned_role=eq.${encodeURIComponent(context.staffRole ?? "")}&status=neq.resolved&limit=250`
    ).catch(() => []);
    return [...new Set((assigned ?? []).map((row) => row.account_id))];
  }
  const rows = await supabaseServiceRoleRequest<MemberRow[]>(
    `/rest/v1/wovo_portal_members?select=account_id,active&user_id=eq.${encodeURIComponent(context.user.id)}&active=eq.true`
  ).catch(() => []);
  return (rows ?? []).map((row) => row.account_id);
}

export async function assertPortalAccountAccess(context: PortalContext, accountId: string): Promise<void> {
  if (!isUuid(accountId)) throw new PortalHttpError(400, "Invalid account.");
  if (context.mode === "staff") {
    if (context.staffRole === "owner") return;
    const assigned = await supabaseServiceRoleRequest<Array<{ account_id: string }>>(
      `/rest/v1/wovo_portal_threads?select=account_id&account_id=eq.${encodeURIComponent(accountId)}&assigned_role=eq.${encodeURIComponent(context.staffRole ?? "")}&status=neq.resolved&limit=1`
    ).catch(() => []);
    if (!assigned?.[0]) throw new PortalHttpError(403, "This client workspace is not assigned to your WOVO role.");
    return;
  }
  const rows = await supabaseServiceRoleRequest<MemberRow[]>(
    `/rest/v1/wovo_portal_members?select=account_id,active&account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(context.user.id)}&active=eq.true&limit=1`
  ).catch(() => []);
  if (!rows?.[0]) throw new PortalHttpError(403, "You do not have access to this client workspace.");
  const active = await supabaseServiceRoleRequest<Array<{ id: string }>>(
    `/rest/v1/wovo_portal_accounts?select=id&id=eq.${encodeURIComponent(accountId)}&archived_at=is.null&limit=1`
  ).catch(() => []);
  if (!active?.[0]) throw new PortalHttpError(404, "Client workspace not found.");
}

export class PortalHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requiredString(value: unknown, label: string, max = 5000): string {
  if (typeof value !== "string") throw new PortalHttpError(400, `${label} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new PortalHttpError(400, `${label} is required.`);
  if (normalized.length > max) throw new PortalHttpError(400, `${label} is too long.`);
  return normalized;
}

export function optionalString(value: unknown, max = 5000): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PortalHttpError(400, "Invalid text value.");
  const normalized = value.trim();
  if (normalized.length > max) throw new PortalHttpError(400, "Text value is too long.");
  return normalized || null;
}

export function parseIsoDate(value: unknown, label: string): string {
  const text = requiredString(value, label, 80);
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw new PortalHttpError(400, `${label} must be a valid date.`);
  return new Date(time).toISOString();
}

export function getPortalPriceId(kind: "monthly" | "quarterly" | "semiannual" | "yearly" | "nonprofit" | "website" | "ad_video" | "shoot" | "drone" | "extra_participant"): string {
  const keyMap = {
    monthly: "WOVO_PORTAL_MONTHLY_PRICE_ID",
    quarterly: "WOVO_PORTAL_QUARTERLY_PRICE_ID",
    semiannual: "WOVO_PORTAL_SEMIANNUAL_PRICE_ID",
    yearly: "WOVO_PORTAL_YEARLY_PRICE_ID",
    nonprofit: "WOVO_PORTAL_NONPROFIT_PRICE_ID",
    website: "WOVO_PORTAL_WEBSITE_PRICE_ID",
    ad_video: "WOVO_PORTAL_AD_VIDEO_PRICE_ID",
    shoot: "WOVO_PORTAL_SHOOT_PRICE_ID",
    drone: "WOVO_PORTAL_DRONE_PRICE_ID",
    extra_participant: "WOVO_PORTAL_EXTRA_PARTICIPANT_PRICE_ID",
  } as const;
  return getEnv(keyMap[kind]);
}
