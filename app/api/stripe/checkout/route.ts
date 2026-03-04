import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanFromPriceId } from "@/lib/wovo-ai/plans";

type CheckoutBody = {
  priceId?: string;
};

type UserSubscriptionRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CheckoutBody;

    if (!body.priceId || !getPlanFromPriceId(body.priceId)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const rows = await supabaseServiceRoleRequest<UserSubscriptionRow[]>(
      `/rest/v1/users?select=id,email,stripe_customer_id&id=eq.${user.id}&limit=1`,
    );

    const existing = rows?.[0] ?? null;

    let customerId = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await supabaseServiceRoleRequest("/rest/v1/users?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email ?? existing?.email ?? "",
          stripe_customer_id: customerId,
        }),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/wovo-ai?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/wovo-ai?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
