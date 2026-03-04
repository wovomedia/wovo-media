import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getPlanConfig, getPlanFromPriceId } from "@/lib/wovo-ai/plans";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  stripe_customer_id: string | null;
};

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const users = await supabaseServiceRoleRequest<UserRow[]>(
    `/rest/v1/users?select=id,stripe_customer_id&stripe_customer_id=eq.${customerId}&limit=1`,
  );

  return users?.[0]?.id ?? null;
}

async function updateUserFromSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planName = getPlanFromPriceId(priceId);
  const customerId = String(subscription.customer);

  const userId = await resolveUserIdFromCustomer(customerId);
  if (!userId || !planName) return;

  const plan = getPlanConfig(planName);

  await supabaseServiceRoleRequest(`/rest/v1/users?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      subscription_status: subscription.status,
      subscription_id: subscription.id,
      price_id: priceId,
      plan: plan.name,
      credits_remaining: plan.monthlyCredits,
      weekly_limit: plan.weeklyLimit,
    }),
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          const userId = session.metadata?.userId ?? null;

          if (userId) {
            await supabaseServiceRoleRequest("/rest/v1/users?on_conflict=id", {
              method: "POST",
              headers: {
                Prefer: "resolution=merge-duplicates,return=minimal",
              },
              body: JSON.stringify({
                id: userId,
                email: session.customer_details?.email ?? "",
                stripe_customer_id: String(session.customer),
              }),
            });
          }

          await updateUserFromSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserFromSubscription(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const userId = await resolveUserIdFromCustomer(customerId);

        if (userId) {
          await supabaseServiceRoleRequest(`/rest/v1/users?id=eq.${userId}`, {
            method: "PATCH",
            headers: {
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              subscription_status: "canceled",
              subscription_id: null,
              price_id: null,
              plan: null,
              credits_remaining: 0,
              weekly_limit: 0,
            }),
          });
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed." },
      { status: 500 },
    );
  }
}
