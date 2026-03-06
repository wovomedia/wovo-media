import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/wovo-ai/profile-bootstrap";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    console.info("[subscription] Session verified", { userId: user.id });
    await ensureProfileForUser(user);
    const status = await getSubscriptionStatus(user.id, user.email);
    console.info("[subscription] Access resolved", { userId: user.id, hasAccess: status.has_access, requiresSubscription: status.requires_subscription });
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
      has_access: false,
      requires_subscription: true,
      can_generate: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
      admin_access: false,
    }, { status: 500 });
  }
}
