import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getPlanConfig, getPlanFromPriceId, isPaidStatus, type PlanName } from "@/lib/wovo-ai/plans";
import { maybeResetMonthlyUsage } from "@/lib/wovo-ai/credits";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";
import type { StripeSubscription } from "@/lib/stripe";

type ProfileRow = {
  user_id: string; plan: PlanName | null; monthly_limit: number | null;
  monthly_used: number | null; extra_credits: number | null;
  subscription_current_period_start: string | null; subscription_current_period_end: string | null;
};

function toStatusPayload(profile: ProfileRow | null, status?: string | null, isAutoPro = false): UnifiedSubscriptionResponse {
  const plan = isAutoPro ? "pro" : (profile?.plan ?? "none");
  const monthlyLimit = isAutoPro ? (profile?.monthly_limit ?? 300) : (profile?.monthly_limit ?? (plan !== "none" ? getPlanConfig(plan as PlanName).monthlyCredits : 0));
  const monthlyUsed = profile?.monthly_used ?? 0;
  const extraCredits = profile?.extra_credits ?? 0;
  const creditsRemaining = Math.max(monthlyLimit + extraCredits - monthlyUsed, 0);
  const recurringActive = isAutoPro || isPaidStatus(status);
  const creditOnlyActive = extraCredits > 0;
  const active = recurringActive || creditOnlyActive;
  return {
    status: active ? "active" : "inactive", plan: plan as PlanName | "none",
    remaining: { monthly_limit: monthlyLimit, monthly_used: monthlyUsed, extra_credits: extraCredits, credits_remaining: creditsRemaining },
    has_access: active, requires_subscription: !recurringActive && !creditOnlyActive, can_generate: creditsRemaining > 0,
  };
}

export async function getSubscriptionStatus(userId: string, userEmail?: string | null): Promise<UnifiedSubscriptionResponse> {
  const autoPro = isAdminProEmail(userEmail);
  await maybeResetMonthlyUsage(userId);
  const rows = await supabaseServiceRoleRequest<ProfileRow[]>(
    `/rest/v1/profiles?select=user_id,plan,monthly_limit,monthly_used,extra_credits,subscription_current_period_start,subscription_current_period_end&user_id=eq.${userId}&limit=1`
  );
  const profile = rows?.[0] ?? null;
  const statusRows = await supabaseServiceRoleRequest<Array<{ status: string | null }>>(
    `/rest/v1/subscriptions?select=status&user_id=eq.${userId}&limit=1`
  );
  return toStatusPayload(profile, statusRows?.[0]?.status ?? null, autoPro);
}

export async function getRawSubscription(userId: string) {
  const profileRows = await supabaseServiceRoleRequest<Array<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>>(
    `/rest/v1/profiles?select=stripe_customer_id,stripe_subscription_id&user_id=eq.${userId}&limit=1`
  );
  const statusRows = await supabaseServiceRoleRequest<Array<{ status: string | null }>>(
    `/rest/v1/subscriptions?select=status&user_id=eq.${userId}&limit=1`
  );
  if (!profileRows?.[0] && !statusRows?.[0]) return null;
  return { stripe_customer_id: profileRows?.[0]?.stripe_customer_id ?? null, stripe_subscription_id: profileRows?.[0]?.stripe_subscription_id ?? null, status: statusRows?.[0]?.status ?? null };
}

export async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const rows = await supabaseServiceRoleRequest<Array<{ user_id: string }>>(
    `/rest/v1/profiles?select=user_id&stripe_customer_id=eq.${customerId}&limit=1`
  );
  return rows?.[0]?.user_id ?? null;
}

function getPeriodIso(unixTime?: number): string | null {
  if (!unixTime) return null;
  return new Date(unixTime * 1000).toISOString();
}

export async function syncSubscriptionFromStripe(subscription: StripeSubscription, fallbackUserId?: string): Promise<void> {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const planKey = getPlanFromPriceId(priceId);
  const customerId = String(subscription.customer);
  const subscriptionItemId = subscription.items?.data?.[0]?.id ?? null;
  if (!planKey) return;
  const userId = fallbackUserId ?? (await findUserIdByCustomerId(customerId));
  if (!userId) return;
  const planConfig = getPlanConfig(planKey);
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ stripe_customer_id: customerId, stripe_subscription_id: subscription.id, stripe_subscription_item_id: subscriptionItemId, plan: planKey, monthly_limit: planConfig.monthlyCredits, monthly_used: 0, subscription_current_period_start: getPeriodIso(subscription.current_period_start), subscription_current_period_end: getPeriodIso(subscription.current_period_end), updated_at: new Date().toISOString() }),
  });
  await supabaseServiceRoleRequest("/rest/v1/subscriptions?on_conflict=user_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, stripe_customer_id: customerId, stripe_subscription_id: subscription.id, status: subscription.status, plan: planKey, current_period_start: getPeriodIso(subscription.current_period_start), current_period_end: getPeriodIso(subscription.current_period_end), updated_at: new Date().toISOString() }),
  });
}

export async function addExtraCredits(userId: string, amount: number): Promise<void> {
  const rows = await supabaseServiceRoleRequest<Array<{ extra_credits: number | null }>>(`/rest/v1/profiles?select=extra_credits&user_id=eq.${userId}&limit=1`);
  const current = rows?.[0]?.extra_credits ?? 0;
  await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ extra_credits: current + amount, updated_at: new Date().toISOString() }),
  });
}

async function markInactive(filter: string): Promise<void> {
  await supabaseServiceRoleRequest(`/rest/v1/subscriptions?${filter}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "inactive", updated_at: new Date().toISOString() }),
  });
}

export async function cancelSubscriptionByStripeSubscriptionId(id: string) { await markInactive(`stripe_subscription_id=eq.${id}`); }
export async function cancelSubscriptionByCustomerId(id: string) { await markInactive(`stripe_customer_id=eq.${id}`); }
