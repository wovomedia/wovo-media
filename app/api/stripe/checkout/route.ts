import { NextResponse } from "next/server";
import { createCheckoutSession, createStripeCustomer } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanFromPriceId } from "@/lib/wovo-ai/plans";

type CheckoutBody = {
  priceId?: string;
};

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CheckoutBody;
    const priceId = body.priceId ?? "";

    if (!priceId || !getPlanFromPriceId(priceId)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
      `/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${user.id}&limit=1`,
    );

    let stripeCustomerId = rows?.[0]?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await createStripeCustomer(user.email ?? "", user.id);
      stripeCustomerId = customer.id;

      await supabaseServiceRoleRequest("/rest/v1/subscriptions?on_conflict=user_id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }),
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      userId: user.id,
      successUrl: `${appUrl}/wovo-ai?stripe=success`,
      cancelUrl: `${appUrl}/wovo-ai?stripe=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
