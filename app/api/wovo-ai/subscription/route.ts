import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/wovo-ai/profile-bootstrap";
import { isAdminProEmail } from "@/lib/wovo-ai/admin";
import { getAuthAccessState } from "@/lib/wovo-ai/access";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    console.info("[subscription] Session verified", { userId: user.id });
    await ensureProfileForUser(user);
    const status = await getSubscriptionStatus(user.id, user.email);
    const accessState = getAuthAccessState({
      user: { id: user.id, email: user.email ?? null },
      subscription: status,
    });
    const adminOverride = isAdminProEmail(user.email);

    console.info("[subscription] Access resolved", {
      userId: user.id,
      hasUser: Boolean(user.id),
      email: user.email ?? null,
      normalizedEmail: user.email?.trim().toLowerCase() ?? "",
      adminOverride,
      subscriptionActive: status.has_access,
      showPaywall: accessState.showPaywall,
    });

    return NextResponse.json({
      ...status,
      admin_access: adminOverride,
      has_app_access: accessState.hasAppAccess,
      needs_plan: accessState.needsPlan,
      show_paywall: accessState.showPaywall,
      effective_plan: accessState.effectivePlan,
      monthly_plan_credits: accessState.monthlyPlanCredits,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      error: "Failed to load subscription status.",
      status: "inactive",
      plan: "none",
      remaining: { monthly_limit: 0, monthly_used: 0, extra_credits: 0, credits_remaining: 0 },
      has_access: false,
      requires_subscription: true,
      can_generate: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
      admin_access: false,
      has_app_access: false,
      needs_plan: true,
      show_paywall: true,
      effective_plan: "none",
      monthly_plan_credits: 0,
    }, { status: 500 });
  }
}
