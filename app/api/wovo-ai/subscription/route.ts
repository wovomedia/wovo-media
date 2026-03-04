import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { isActiveSubscription } from "@/lib/wovo-ai/plans";

type UserSubscriptionRow = {
  plan: string | null;
  credits_remaining: number | null;
  weekly_limit: number | null;
  subscription_status: string | null;
};

type GenerationRow = { id: string };

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    const users = await supabaseServiceRoleRequest<UserSubscriptionRow[]>(
      `/rest/v1/users?select=plan,credits_remaining,weekly_limit,subscription_status&id=eq.${user.id}&limit=1`,
    );

    const row = users?.[0] ?? null;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const generated = await supabaseServiceRoleRequest<GenerationRow[]>(
      `/rest/v1/generations?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(since)}`,
    );

    const usedThisWeek = generated?.length ?? 0;

    return NextResponse.json({
      subscribed: Boolean(row?.plan && isActiveSubscription(row.subscription_status)),
      currentPlan: row?.plan,
      creditsRemaining: row?.credits_remaining ?? 0,
      weeklyLimit: row?.weekly_limit ?? 0,
      postsUsedThisWeek: usedThisWeek,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
