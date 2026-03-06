import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import type { Session } from "@/lib/supabase/client";

export type AiAccessState = {
  hasAccess: boolean;
  requiresSubscription: boolean;
  showPaywall: boolean;
};

export type AuthAccessState = {
  isAuthenticated: boolean;
  needsPlan: boolean;
  hasAppAccess: boolean;
};

export function resolveAiAccessState(subscription: UnifiedSubscriptionResponse | null | undefined): AiAccessState {
  const hasAccess = Boolean(subscription?.has_access ?? subscription?.status === "active");

  return {
    hasAccess,
    requiresSubscription: !hasAccess,
    showPaywall: !hasAccess,
  };
}

export function getAuthAccessState(params: {
  session?: Session | null;
  user?: { id?: string | null } | null;
  subscription?: UnifiedSubscriptionResponse | null;
}): AuthAccessState {
  const isAuthenticated = Boolean(params.user?.id ?? params.session?.access_token);
  const hasSubscriptionAccess = resolveAiAccessState(params.subscription).hasAccess;
  const hasAppAccess = isAuthenticated && hasSubscriptionAccess;

  return {
    isAuthenticated,
    needsPlan: isAuthenticated && !hasAppAccess,
    hasAppAccess,
  };
}
