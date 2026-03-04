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
  can_generate: boolean;
  message?: string;
};
