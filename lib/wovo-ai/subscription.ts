import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { type UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getPlanConfig, getPlanFromPriceId, isPaidStatus, type PlanName } from "@/lib/wovo-ai/plans";
import type { StripeSubscription } from "@/lib/stripe";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  plan: PlanName | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

type ProfileCreditsRow = {
  credits: number | null;
  weekly_usage: number | null;
  weekly_limit: number | null;
};

function getDefaultRemaining(plan: PlanName | "none") {
  if (plan === "none") {
    return { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 };
  }

  const config = getPlanConfig(plan);
  return {
    credits_total: config.monthlyCredits,
    credits_remaining: config.monthlyCredits,
    weekly_limit: config.weeklyLimit,
    weekly_used: 0,
  };
}

function toStatusPayload(row: SubscriptionRow | null, profile: ProfileCreditsRow | null): UnifiedSubscriptionResponse {
  const plan = row?.plan ?? "none";
  const defaults = getDefaultRemaining(plan);
  const remaining = {
    credits_total: defaults.credits_total,
    credits_remaining: profile?.credits ?? defaults.credits_remaining,
    weekly_limit: profile?.weekly_limit ?? defaults.weekly_limit,
    weekly_used: profile?.weekly_usage ?? defaults.weekly_used,
  };

  const status: "active" | "inactive" = isPaidStatus(row?.status) ? "active" : "inactive";
  const weeklyAllowed = remaining.weekly_limit <= 0 || remaining.weekly_used < remaining.weekly_limit;

  return {
    status,
    plan,
    remaining,
    can_generate: status === "active" && remaining.credits_remaining > 0 && weeklyAllowed,
  };
}

export async function getSubscriptionStatus(userId: string): Promise<UnifiedSubscriptionResponse> {
  const [subscriptionRows, profileRows] = await Promise.all([
    supabaseServiceRoleRequest<SubscriptionRow[]>(
      `/rest/v1/subscriptions?select=user_id,plan,status,current_period_start,current_period_end,stripe_customer_id&user_id=eq.${userId}&limit=1`,
    ),
    supabaseServiceRoleRequest<ProfileCreditsRow[]>(
      `/rest/v1/profiles?select=credits,weekly_usage,weekly_limit&user_id=eq.${userId}&limit=1`,
    ),
  ]);

  return toStatusPayload(subscriptionRows?.[0] ?? null, profileRows?.[0] ?? null);
}

export async function getRawSubscription(userId: string): Promise<SubscriptionRow | null> {
  const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
    `/rest/v1/subscriptions?select=*&user_id=eq.${userId}&limit=1`,
  );
  return rows?.[0] ?? null;
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
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseServiceRoleRequest("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      credits: planConfig.monthlyCredits,
      weekly_limit: planConfig.weeklyLimit,
      weekly_usage: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function markInactive(filter: string): Promise<void> {
  await supabaseServiceRoleRequest(`/rest/v1/subscriptions?${filter}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "inactive",
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function cancelSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<void> {
  await markInactive(`stripe_subscription_id=eq.${subscriptionId}`);
}

export async function cancelSubscriptionByCustomerId(customerId: string): Promise<void> {
  await markInactive(`stripe_customer_id=eq.${customerId}`);
}
