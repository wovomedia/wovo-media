import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getPlanFromPriceId } from "@/lib/wovo-ai/plans";

type CheckoutBody = {
  priceId?: string;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as CheckoutBody;
    const priceId = body.priceId ?? "";

    if (!priceId || !getPlanFromPriceId(priceId)) {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser(user.id, user.email);

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
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
