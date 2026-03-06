import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import type { Session } from "@/lib/supabase/client";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";

export type AiAccessState = {
  hasAccess: boolean;
  requiresSubscription: boolean;
  showPaywall: boolean;
};

export type AuthAccessState = {
  isAuthenticated: boolean;
  needsPlan: boolean;
  hasAppAccess: boolean;
  effectivePlan: "none" | "starter" | "pro" | "business";
  monthlyPlanCredits: number;
  showPaywall: boolean;
};

function getMonthlyPlanCredits(plan: "none" | "starter" | "pro" | "business", subscription?: UnifiedSubscriptionResponse | null): number {
  if (typeof subscription?.remaining?.monthly_limit === "number") {
    return subscription.remaining.monthly_limit;
  }

  if (plan === "starter") return 50;
  if (plan === "business") return 300;
  if (plan === "pro") return 150;
  return 0;
}

export function resolveAiAccessState(subscription: UnifiedSubscriptionResponse | null | undefined, userEmail?: string | null): AiAccessState {
  const adminAccess = isAdminProEmail(userEmail);
  const hasAccess = adminAccess || Boolean(subscription?.has_access ?? subscription?.status === "active");

  return {
    hasAccess,
    requiresSubscription: !hasAccess,
    showPaywall: !hasAccess,
  };
}

export function getAuthAccessState(params: {
  session?: Session | null;
  user?: { id?: string | null; email?: string | null } | null;
  subscription?: UnifiedSubscriptionResponse | null;
  userEmail?: string | null;
}): AuthAccessState {
  const isAuthenticated = Boolean(params.user?.id ?? params.session?.access_token);
  const email = params.userEmail ?? params.user?.email ?? null;
  const adminAccess = isAdminProEmail(email);
  const accessState = resolveAiAccessState(params.subscription, email);
  const hasAppAccess = isAuthenticated && (adminAccess || accessState.hasAccess);
  const effectivePlan = adminAccess ? "pro" : (params.subscription?.plan ?? "none");
  const monthlyPlanCredits = adminAccess ? 300 : getMonthlyPlanCredits(effectivePlan, params.subscription);
  const needsPlan = isAuthenticated && !hasAppAccess;

  return {
    isAuthenticated,
    needsPlan,
    hasAppAccess,
    effectivePlan,
    monthlyPlanCredits,
    showPaywall: needsPlan,
  };
}
