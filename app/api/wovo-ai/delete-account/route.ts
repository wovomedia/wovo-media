import { NextResponse } from "next/server";
import { cancelStripeSubscription } from "@/lib/stripe";
import { deleteAuthUserById, requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    const rows = await supabaseServiceRoleRequest<Array<{ stripe_subscription_id: string | null }>>(
      `/rest/v1/subscriptions?select=stripe_subscription_id&user_id=eq.${user.id}&limit=1`,
    );
    const subscriptionId = rows?.[0]?.stripe_subscription_id ?? null;

    if (subscriptionId) {
      try {
        await cancelStripeSubscription(subscriptionId);
      } catch {
        // Ignore Stripe cancellation failures and continue deleting account.
      }
    }

    await deleteAuthUserById(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
