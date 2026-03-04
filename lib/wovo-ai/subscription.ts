import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanConfig, getPlanFromPriceId, isPaidStatus, type PlanName } from "@/lib/wovo-ai/plans";
import type { StripeSubscription } from "@/lib/stripe";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  plan: PlanName | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_credits_total: number | null;
  monthly_credits_remaining: number | null;
  weekly_limit: number | null;
  weekly_used: number | null;
  weekly_window_start: string | null;
};

export type SubscriptionStatusPayload = {
  status: string | null;
  plan_key: PlanName | null;
  credits_used_month: number;
  credits_limit_month: number;
  period_end: string | null;
  can_generate: boolean;
  weekly_limit: number;
  weekly_used: number;
};

function toStatusPayload(row: SubscriptionRow | null): SubscriptionStatusPayload {
  const creditsTotal = row?.monthly_credits_total ?? 0;
  const creditsRemaining = row?.monthly_credits_remaining ?? 0;
  const creditsUsed = Math.max(creditsTotal - creditsRemaining, 0);
  const status = row?.status ?? null;
  const weeklyLimit = row?.weekly_limit ?? 0;
  const weeklyUsed = row?.weekly_used ?? 0;

  return {
    status,
    plan_key: row?.plan ?? null,
    credits_used_month: creditsUsed,
    credits_limit_month: creditsTotal,
    period_end: row?.current_period_end ?? null,
    can_generate: isPaidStatus(status) && creditsRemaining > 0 && (weeklyLimit <= 0 || weeklyUsed < weeklyLimit),
    weekly_limit: weeklyLimit,
    weekly_used: weeklyUsed,
  };
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatusPayload> {
  const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
    `/rest/v1/subscriptions?select=user_id,plan,status,current_period_start,current_period_end,monthly_credits_total,monthly_credits_remaining,weekly_limit,weekly_used,weekly_window_start,stripe_customer_id&user_id=eq.${userId}&limit=1`,
  );

  return toStatusPayload(rows?.[0] ?? null);
}

export async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const rows = await supabaseServiceRoleRequest<Array<{ user_id: string }>>(
    `/rest/v1/subscriptions?select=user_id&stripe_customer_id=eq.${customerId}&limit=1`,
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

  if (!planKey) return;

  const userId = fallbackUserId ?? (await findUserIdByCustomerId(customerId));
  if (!userId) return;

  const planConfig = getPlanConfig(planKey);
  const currentPeriodStart = getPeriodIso(subscription.current_period_start);
  const currentPeriodEnd = getPeriodIso(subscription.current_period_end);

  const rows = await supabaseServiceRoleRequest<Array<{ current_period_start: string | null }>>(
    `/rest/v1/subscriptions?select=current_period_start&user_id=eq.${userId}&limit=1`,
  );
  const existingPeriodStart = rows?.[0]?.current_period_start ?? null;
  const resetMonthly = Boolean(currentPeriodStart) && existingPeriodStart !== currentPeriodStart;

  await supabaseServiceRoleRequest("/rest/v1/subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan: planKey,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      monthly_credits_total: planConfig.monthlyCredits,
      monthly_credits_remaining: resetMonthly ? planConfig.monthlyCredits : undefined,
      weekly_limit: planConfig.weeklyLimit,
      weekly_used: resetMonthly ? 0 : undefined,
      weekly_window_start: resetMonthly ? currentPeriodStart : undefined,
      updated_at: new Date().toISOString(),
    }),
  });
}


export async function cancelSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<void> {
  await supabaseServiceRoleRequest(`/rest/v1/subscriptions?stripe_subscription_id=eq.${subscriptionId}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "canceled",
      monthly_credits_total: 0,
      monthly_credits_remaining: 0,
      weekly_limit: 0,
      weekly_used: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function cancelSubscriptionByCustomerId(customerId: string): Promise<void> {
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) return;

  await supabaseServiceRoleRequest(`/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "canceled",
      monthly_credits_total: 0,
      monthly_credits_remaining: 0,
      weekly_limit: 0,
      weekly_used: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}
