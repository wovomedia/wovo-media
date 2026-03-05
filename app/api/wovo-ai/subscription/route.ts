import { NextResponse } from "next/server";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { requireServerUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getPlanConfig } from "@/lib/wovo-ai/plans";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

function adminResponse(): UnifiedSubscriptionResponse {
  const plan = getPlanConfig("business");
  return {
    status: "active",
    plan: "business",
    remaining: {
      monthly_limit: plan.monthlyCredits,
      monthly_used: 0,
      extra_credits: 0,
      credits_remaining: plan.monthlyCredits,
    },
    can_generate: true,
    message: "Admin allowlist access enabled.",
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    if (user.email?.toLowerCase() === "payton@wovomedia.com") {
      return NextResponse.json({ active: true, tier: "pro", plan: "Pro", remaining_credits: 100 });
    }

    if (isAdminEmail(user.email)) {
      return NextResponse.json({ ...adminResponse(), admin_access: true });
    }

    const status = await getSubscriptionStatus(user.id);
    return NextResponse.json({ ...status, admin_access: false });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fallback: UnifiedSubscriptionResponse = {
      status: "inactive",
      plan: "none",
      remaining: { monthly_limit: 0, monthly_used: 0, extra_credits: 0, credits_remaining: 0 },
      can_generate: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
    };

    return NextResponse.json({ error: "Failed to load subscription status.", ...fallback, admin_access: false }, { status: 500 });
  }
}
