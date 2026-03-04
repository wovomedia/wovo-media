import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
      `/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${user.id}&limit=1`,
    );

    const stripeCustomerId = rows?.[0]?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer found." }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await createPortalSession(stripeCustomerId, `${appUrl}/wovo-ai`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
