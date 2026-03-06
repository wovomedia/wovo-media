import type { PlanName } from "@/lib/wovo-ai/plans";

export type ResponsePlan = PlanName | "none";

export type RemainingCredits = {
  monthly_limit: number;
  monthly_used: number;
  extra_credits: number;
  credits_remaining: number;
};

export type UnifiedSubscriptionResponse = {
  status: "active" | "inactive";
  plan: ResponsePlan;
  remaining: RemainingCredits;
  has_access: boolean;
  requires_subscription: boolean;
  can_generate: boolean;
  message?: string;
  admin_access?: boolean;
  has_app_access?: boolean;
  needs_plan?: boolean;
  show_paywall?: boolean;
  effective_plan?: ResponsePlan;
  monthly_plan_credits?: number;
};
