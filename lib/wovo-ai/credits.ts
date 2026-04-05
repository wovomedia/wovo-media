import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export type ProfileCredits = {
  monthly_limit: number; monthly_used: number; extra_credits: number;
  subscription_current_period_start: string | null;
};

function nowIso() { return new Date().toISOString(); }
function addMonthIso(from: string) { const d = new Date(from); d.setMonth(d.getMonth() + 1); return d.toISOString(); }
function needsReset(start: string | null): boolean {
  if (!start) return false;
  const s = new Date(start), now = new Date();
  return s.getUTCFullYear() !== now.getUTCFullYear() || s.getUTCMonth() !== now.getUTCMonth();
}

export async function getProfileCredits(userId: string): Promise<ProfileCredits> {
  const rows = await supabaseServiceRoleRequest<ProfileCredits[]>(
    `/rest/v1/profiles?select=monthly_limit,monthly_used,extra_credits,subscription_current_period_start&user_id=eq.${userId}&limit=1`
  );
  const r = rows?.[0];
  return { monthly_limit: r?.monthly_limit ?? 0, monthly_used: r?.monthly_used ?? 0, extra_credits: r?.extra_credits ?? 0, subscription_current_period_start: r?.subscription_current_period_start ?? null };
}

export async function maybeResetMonthlyUsage(userId: string): Promise<void> {
  const p = await getProfileCredits(userId);
  if (!needsReset(p.subscription_current_period_start)) return;
  const resetAt = nowIso();
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ monthly_used: 0, subscription_current_period_start: resetAt, subscription_current_period_end: addMonthIso(resetAt), updated_at: resetAt }),
  });
}

export async function consumePromptCredits(userId: string, creditCost: number): Promise<{ remaining: number; monthly_used: number }> {
  await maybeResetMonthlyUsage(userId);
  const p = await getProfileCredits(userId);
  const remaining = p.monthly_limit - p.monthly_used + p.extra_credits;
  if (creditCost <= 0) throw new Error("Invalid credit cost.");
  if (remaining < creditCost) throw new Error("Not enough credits for this action.");
  const monthlyAvail = Math.max(p.monthly_limit - p.monthly_used, 0);
  const monthlyToUse = Math.min(monthlyAvail, creditCost);
  const extraToUse = creditCost - monthlyToUse;
  const nextMonthlyUsed = p.monthly_used + monthlyToUse;
  const nextExtra = Math.max(p.extra_credits - extraToUse, 0);
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ monthly_used: nextMonthlyUsed, extra_credits: nextExtra, updated_at: nowIso() }),
  });
  return { remaining: p.monthly_limit - nextMonthlyUsed + nextExtra, monthly_used: nextMonthlyUsed };
}
