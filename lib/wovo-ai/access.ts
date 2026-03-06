import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";

export type AiAccessState = {
  hasAccess: boolean;
  requiresSubscription: boolean;
  showPaywall: boolean;
};

export function resolveAiAccessState(subscription: UnifiedSubscriptionResponse | null | undefined): AiAccessState {
  const hasAccess = Boolean(subscription?.has_access ?? subscription?.status === "active");

  return {
    hasAccess,
    requiresSubscription: !hasAccess,
    showPaywall: !hasAccess,
  };
}
