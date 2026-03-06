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
  showPaywall: boolean;
};

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
  const needsPlan = isAuthenticated && !hasAppAccess;

  return {
    isAuthenticated,
    needsPlan,
    hasAppAccess,
    effectivePlan,
    showPaywall: needsPlan,
  };
}
