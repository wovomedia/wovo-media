import { NextResponse } from "next/server";
import type { UnifiedSubscriptionResponse } from "@/lib/wovo-ai/contracts";
import { requireServerUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getPlanConfig } from "@/lib/wovo-ai/plans";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

function adminResponse(): UnifiedSubscriptionResponse {
  const plan = getPlanConfig("agency");
  return {
    status: "active",
    plan: "agency",
    remaining: {
      credits_total: plan.monthlyCredits,
      credits_remaining: plan.monthlyCredits,
      weekly_limit: plan.weeklyLimit,
      weekly_used: 0,
    },
    can_generate: true,
    message: "Admin allowlist access enabled.",
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
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
      remaining: { credits_total: 0, credits_remaining: 0, weekly_limit: 0, weekly_used: 0 },
      can_generate: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
    };

    return NextResponse.json({ ...fallback, admin_access: false }, { status: 200 });
  }
}
