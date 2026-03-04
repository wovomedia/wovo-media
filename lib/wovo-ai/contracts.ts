import type { PlanName } from "@/lib/wovo-ai/plans";

export type ResponsePlan = PlanName | "none";

export type RemainingCredits = {
  credits_total: number;
  credits_remaining: number;
  weekly_limit: number;
  weekly_used: number;
};

export type UnifiedSubscriptionResponse = {
  status: "active" | "inactive";
  plan: ResponsePlan;
  remaining: RemainingCredits;
  can_generate: boolean;
  message?: string;
};
