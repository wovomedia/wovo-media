import { NextResponse } from "next/server";
import { requireServerUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/wovo-ai/admin";
import { getSubscriptionStatus } from "@/lib/wovo-ai/subscription";

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    if (isAdminEmail(user.email)) {
      return NextResponse.json({
        status: "admin",
        plan_key: "admin",
        credits_used_month: 0,
        credits_limit_month: 999999,
        period_end: null,
        can_generate: true,
      });
    }
    const status = await getSubscriptionStatus(user.id);

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("PGRST205")) {
      return NextResponse.json(
        {
          status: null,
          plan_key: null,
          credits_used_month: 0,
          credits_limit_month: 0,
          period_end: null,
          can_generate: false,
          warning: "Database not migrated yet",
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
