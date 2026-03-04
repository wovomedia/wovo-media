import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { type UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { getPlanConfig, getPlanFromPriceId, isPaidStatus, type PlanName } from "@/lib/wovo-ai/plans";
import type { StripeSubscription } from "@/lib/stripe";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  plan: PlanName | null;
  status: string | null;
};

type ProfileCreditsRow = {
  plan: PlanName | null;
  monthly_limit: number | null;
  monthly_used: number | null;
  extra_credits: number | null;
};

function toStatusPayload(row: SubscriptionRow | null, profile: ProfileCreditsRow | null): UnifiedSubscriptionResponse {
  const plan = row?.plan ?? profile?.plan ?? "none";
  const monthlyLimit = profile?.monthly_limit ?? (plan !== "none" ? getPlanConfig(plan).monthlyCredits : 0);
  const monthlyUsed = profile?.monthly_used ?? 0;
  const extraCredits = profile?.extra_credits ?? 0;
  const creditsRemaining = Math.max(monthlyLimit + extraCredits - monthlyUsed, 0);
  const status: "active" | "inactive" = isPaidStatus(row?.status) ? "active" : "inactive";

  return {
    status,
    plan,
    remaining: {
      monthly_limit: monthlyLimit,
      monthly_used: monthlyUsed,
      extra_credits: extraCredits,
      credits_remaining: creditsRemaining,
    },
    can_generate: status === "active" && creditsRemaining > 0,
  };
}

export async function getSubscriptionStatus(userId: string): Promise<UnifiedSubscriptionResponse> {
  const [subscriptionRows, profileRows] = await Promise.all([
    supabaseServiceRoleRequest<SubscriptionRow[]>(
      `/rest/v1/subscriptions?select=user_id,plan,status,stripe_customer_id&user_id=eq.${userId}&limit=1`,
    ),
    supabaseServiceRoleRequest<ProfileCreditsRow[]>(
      `/rest/v1/profiles?select=plan,monthly_limit,monthly_used,extra_credits&user_id=eq.${userId}&limit=1`,
    ),
  ]);

  return toStatusPayload(subscriptionRows?.[0] ?? null, profileRows?.[0] ?? null);
}

export async function getRawSubscription(userId: string): Promise<SubscriptionRow | null> {
  const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(`/rest/v1/subscriptions?select=*&user_id=eq.${userId}&limit=1`);
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
      current_period_start: getPeriodIso(subscription.current_period_start),
      current_period_end: getPeriodIso(subscription.current_period_end),
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseServiceRoleRequest("/rest/v1/profiles?user_id=eq." + userId, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      plan: planKey,
      monthly_limit: planConfig.monthlyCredits,
      monthly_used: 0,
      credits_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function addExtraCredits(userId: string, amount: number): Promise<void> {
  const rows = await supabaseServiceRoleRequest<Array<{ extra_credits: number | null }>>(
    `/rest/v1/profiles?select=extra_credits&user_id=eq.${userId}&limit=1`,
  );
  const current = rows?.[0]?.extra_credits ?? 0;

  await supabaseServiceRoleRequest("/rest/v1/profiles?user_id=eq." + userId, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      extra_credits: current + amount,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function markInactive(filter: string): Promise<void> {
  await supabaseServiceRoleRequest(`/rest/v1/subscriptions?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "inactive", updated_at: new Date().toISOString() }),
  });
}

export async function cancelSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<void> {
  await markInactive(`stripe_subscription_id=eq.${subscriptionId}`);
}

export async function cancelSubscriptionByCustomerId(customerId: string): Promise<void> {
  await markInactive(`stripe_customer_id=eq.${customerId}`);
}
