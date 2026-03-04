import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanConfig, getPlanFromPriceId, type PlanName } from "@/lib/wovo-ai/plans";
import type { StripeSubscription } from "@/lib/stripe";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  current_period_start: string | null;
};

export type SubscriptionStatusPayload = {
  status: string | null;
  plan_key: PlanName | null;
  credits_used_month: number;
  credits_limit_month: number;
  period_end: string | null;
  can_generate: boolean;
};

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatusPayload> {
  const subscriptionRows = await supabaseServiceRoleRequest<Array<{ status: string | null; plan_key: PlanName | null; current_period_end: string | null }>>(
    `/rest/v1/subscriptions?select=status,plan_key,current_period_end&user_id=eq.${userId}&limit=1`,
  );

  const usageRows = await supabaseServiceRoleRequest<Array<{ credits_used_month: number | null; credits_limit_month: number | null }>>(
    `/rest/v1/usage_credits?select=credits_used_month,credits_limit_month&user_id=eq.${userId}&limit=1`,
  );

  const subscription = subscriptionRows?.[0] ?? null;
  const usage = usageRows?.[0] ?? null;

  const creditsUsed = usage?.credits_used_month ?? 0;
  const creditsLimit = usage?.credits_limit_month ?? 0;
  const paidStatus = ["active", "trialing"].includes(subscription?.status ?? "");

  return {
    status: subscription?.status ?? null,
    plan_key: subscription?.plan_key ?? null,
    credits_used_month: creditsUsed,
    credits_limit_month: creditsLimit,
    period_end: subscription?.current_period_end ?? null,
    can_generate: paidStatus && creditsUsed < creditsLimit,
  };
}

export async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
    `/rest/v1/subscriptions?select=user_id,stripe_customer_id,current_period_start&stripe_customer_id=eq.${customerId}&limit=1`,
  );

  return rows?.[0]?.user_id ?? null;
}

export async function syncSubscriptionFromStripe(subscription: StripeSubscription, fallbackUserId?: string): Promise<void> {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const planKey = getPlanFromPriceId(priceId);
  const customerId = String(subscription.customer);

  if (!planKey) {
    return;
  }

  const userId = fallbackUserId ?? (await findUserIdByCustomerId(customerId));
  if (!userId) {
    return;
  }

  const planConfig = getPlanConfig(planKey);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const existingUsageRows = await supabaseServiceRoleRequest<Array<{ period_start: string | null }>>(
    `/rest/v1/usage_credits?select=period_start&user_id=eq.${userId}&limit=1`,
  );

  const previousPeriodStart = existingUsageRows?.[0]?.period_start ?? null;
  const resetCredits = previousPeriodStart !== currentPeriodStart;

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
      plan_key: planKey,
      price_id: priceId,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseServiceRoleRequest("/rest/v1/usage_credits?on_conflict=user_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      credits_limit_month: planConfig.monthlyCredits,
      credits_used_month: resetCredits ? 0 : undefined,
      period_start: currentPeriodStart,
      period_end: currentPeriodEnd,
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
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseServiceRoleRequest(`/rest/v1/usage_credits?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      credits_limit_month: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}
