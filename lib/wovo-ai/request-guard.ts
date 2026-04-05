import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { consumePromptCredits, getProfileCredits, maybeResetMonthlyUsage } from "@/lib/wovo-ai/credits";
import { checkAiRateLimit } from "@/lib/wovo-ai/rate-limit";
import { getPromptCreditCost } from "@/lib/wovo-ai/usage";

type GuardSuccess = { userId: string; remainingCredits: number };

export async function guardAiRequest(authorizationHeader: string | null, actionType: string): Promise<GuardSuccess> {
  const { user } = await requireServerUser(authorizationHeader);
  const userId = user.id;
  const rateLimit = checkAiRateLimit(userId, actionType);
  if (!rateLimit.allowed) throw new Error("You're sending requests too quickly. Please wait a few minutes and try again.");
  await maybeResetMonthlyUsage(userId);
  const profile = await getProfileCredits(userId);
  const remainingCredits = profile.monthly_limit - profile.monthly_used + profile.extra_credits;
  const creditCost = getPromptCreditCost(actionType);
  if (remainingCredits < creditCost) throw new Error("Not enough credits for this action.");
  await consumePromptCredits(userId, creditCost);
  return { userId, remainingCredits: remainingCredits - creditCost };
}

export function toAiGuardErrorResponse(error: unknown) {
  if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "Not enough credits for this action.") {
    return NextResponse.json({ error: error.message }, { status: 402 });
  }
  if (error instanceof Error && error.message.includes("too quickly")) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  return null;
}
