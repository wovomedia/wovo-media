import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    if (isAdminEmail(user.email)) {
      return NextResponse.json({
        status: "active",
        plan: "agency",
        period_end: null,
        remaining: {
          credits_total: 999999,
          credits_remaining: 999999,
          weekly_limit: 999999,
          weekly_used: 0,
        },
        can_generate: true,
        admin_access: true,
      });
    }

    const status = await getSubscriptionStatus(user.id);
    return NextResponse.json({ ...status, admin_access: false });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("PGRST205")) {
      return NextResponse.json(
        {
          status: null,
          plan: null,
          period_end: null,
          remaining: {
            credits_total: 0,
            credits_remaining: 0,
            weekly_limit: 0,
            weekly_used: 0,
          },
          can_generate: false,
          admin_access: false,
          message: "Database not migrated yet",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
