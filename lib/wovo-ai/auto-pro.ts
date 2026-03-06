import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";

export function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isAutoProEmail(email?: string | null): boolean {
  return isAdminProEmail(email);
}

type AutoProProfileRow = {
  plan: string | null;
  monthly_limit: number | null;
  subscription_current_period_start: string | null;
  subscription_current_period_end: string | null;
};

function addMonthIso(fromIso: string): string {
  const date = new Date(fromIso);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

export async function applyAutoProEntitlements(userId: string, email?: string | null): Promise<boolean> {
  if (!isAutoProEmail(email)) return false;

  const adminProMonthlyCredits = 300;
  const rows = await supabaseServiceRoleRequest<AutoProProfileRow[]>(
    `/rest/v1/profiles?select=plan,monthly_limit,subscription_current_period_start,subscription_current_period_end&user_id=eq.${userId}&limit=1`,
  );
  const profile = rows?.[0] ?? null;
  const now = new Date().toISOString();

  const needsPlanUpdate = (profile?.plan ?? "none") !== "pro";
  const needsLimitUpdate = (profile?.monthly_limit ?? 0) !== adminProMonthlyCredits;
  const needsPeriodStart = !profile?.subscription_current_period_start;
  const needsPeriodEnd = !profile?.subscription_current_period_end;

  if (!needsPlanUpdate && !needsLimitUpdate && !needsPeriodStart && !needsPeriodEnd) {
    return true;
  }

  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      plan: "pro",
      monthly_limit: adminProMonthlyCredits,
      subscription_current_period_start: profile?.subscription_current_period_start ?? now,
      subscription_current_period_end: profile?.subscription_current_period_end ?? addMonthIso(now),
      updated_at: now,
    }),
  });

  return true;
}
