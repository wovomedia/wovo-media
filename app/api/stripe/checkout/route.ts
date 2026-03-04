import { NextResponse } from "next/server";
import { createCheckoutSession, createStripeCustomer } from "@/lib/stripe";
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
      const customer = await createStripeCustomer(user.email ?? existing?.email ?? "", user.id);
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const session = await createCheckoutSession({
      customerId,
      priceId: body.priceId,
      userId: user.id,
      successUrl: `${siteUrl}/wovo-ai?success=true`,
      cancelUrl: `${siteUrl}/wovo-ai?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
