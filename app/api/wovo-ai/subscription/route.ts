import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const status = await getSubscriptionStatus(user.id);
    return NextResponse.json({ ...status, admin_access: isAdminEmail(user.email) });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      error: "Failed to load subscription status.",
      status: "inactive",
      plan: "none",
      remaining: { monthly_limit: 0, monthly_used: 0, extra_credits: 0, credits_remaining: 0 },
      can_generate: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
      admin_access: false,
    }, { status: 500 });
  }
}
