import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export type ProfileCredits = {
  monthly_limit: number;
  monthly_used: number;
  extra_credits: number;
  subscription_current_period_start: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function addMonthIso(fromIso: string): string {
  const d = new Date(fromIso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function needsMonthlyReset(currentPeriodStart: string | null): boolean {
  if (!currentPeriodStart) return false;
  const start = new Date(currentPeriodStart);
  const now = new Date();
  return start.getUTCFullYear() !== now.getUTCFullYear() || start.getUTCMonth() !== now.getUTCMonth();
}

export async function getProfileCredits(userId: string): Promise<ProfileCredits> {
  const rows = await supabaseServiceRoleRequest<ProfileCredits[]>(
    `/rest/v1/profiles?select=monthly_limit,monthly_used,extra_credits,subscription_current_period_start&user_id=eq.${userId}&limit=1`,
  );
  const row = rows?.[0];
  return {
    monthly_limit: row?.monthly_limit ?? 0,
    monthly_used: row?.monthly_used ?? 0,
    extra_credits: row?.extra_credits ?? 0,
    subscription_current_period_start: row?.subscription_current_period_start ?? null,
  };
}

export async function maybeResetMonthlyUsage(userId: string): Promise<void> {
  const profile = await getProfileCredits(userId);
  if (!needsMonthlyReset(profile.subscription_current_period_start)) return;

  const resetAt = nowIso();
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      monthly_used: 0,
      subscription_current_period_start: resetAt,
      subscription_current_period_end: addMonthIso(resetAt),
      updated_at: resetAt,
    }),
  });
}

export async function consumeOneCredit(userId: string): Promise<{ remaining: number; monthly_used: number }> {
  await maybeResetMonthlyUsage(userId);
  const profile = await getProfileCredits(userId);
  const remaining = profile.monthly_limit - profile.monthly_used + profile.extra_credits;

  if (remaining <= 0) {
    throw new Error("No credits remaining. Please upgrade or buy extra credits.");
  }

  let nextMonthlyUsed = profile.monthly_used;
  let nextExtraCredits = profile.extra_credits;

  if (profile.monthly_used < profile.monthly_limit) {
    nextMonthlyUsed = profile.monthly_used + 1;
  } else {
    nextExtraCredits = Math.max(profile.extra_credits - 1, 0);
  }

  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      monthly_used: nextMonthlyUsed,
      extra_credits: nextExtraCredits,
      updated_at: nowIso(),
    }),
  });

  return { remaining: profile.monthly_limit - nextMonthlyUsed + nextExtraCredits, monthly_used: nextMonthlyUsed };
}
