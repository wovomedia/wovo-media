import { NextResponse } from "next/server";
import Stripe from "stripe";
import { retrieveSubscription, type StripeSubscription } from "@/lib/stripe";
import { cancelSubscriptionByCustomerId, cancelSubscriptionByStripeSubscriptionId, syncSubscriptionFromStripe } from "@/lib/wovo-ai/subscription";
import {
  beginPortalStripeEvent,
  failPortalStripeEvent,
  finishPortalStripeEvent,
  handlePortalCheckoutCompleted,
  syncPortalSubscription,
} from "@/lib/portal/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  const shouldProcess = await beginPortalStripeEvent(event.id, event.type);
  if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as {
          id: string;
          subscription?: string;
          customer?: string;
          payment_intent?: string;
          metadata?: {
            userId?: string;
            product?: string;
            portalAccountId?: string;
            portalOrderId?: string;
            portalPurchaseType?: string;
            portalBillingFrequency?: string;
          };
        };
        await handlePortalCheckoutCompleted(session);
        if (session.subscription) {
          const sub = await retrieveSubscription(String(session.subscription));
          await syncSubscriptionFromStripe(sub, session.metadata?.userId);
          await syncPortalSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as StripeSubscription;
        await syncSubscriptionFromStripe(subscription);
        await syncPortalSubscription(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        await cancelSubscriptionByStripeSubscriptionId(sub.id);
        await cancelSubscriptionByCustomerId(String(sub.customer));
        await syncPortalSubscription(sub);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as { subscription?: string | null };
        if (inv.subscription) {
          const sub = await retrieveSubscription(String(inv.subscription));
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      default: break;
    }
    await finishPortalStripeEvent(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await failPortalStripeEvent(event.id, error instanceof Error ? error.message : "Webhook handler failed.");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook handler failed." }, { status: 500 });
  }
}
