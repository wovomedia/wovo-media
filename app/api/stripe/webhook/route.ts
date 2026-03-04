import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { retrieveSubscription, type StripeSubscription } from "@/lib/stripe";
import {
  cancelSubscriptionByCustomerId,
  cancelSubscriptionByStripeSubscriptionId,
  syncSubscriptionFromStripe,
} from "@/lib/wovo-ai/subscription";

export const runtime = "nodejs";

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

function verifySignature(payload: string, signatureHeader: string, secret: string): boolean {
  const elements = signatureHeader.split(",").map((entry) => entry.trim());
  const timestamp = elements.find((part) => part.startsWith("t="))?.slice(2);
  const signature = elements.find((part) => part.startsWith("v1="))?.slice(3);

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
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

  if (!verifySignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: StripeEvent;

  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          customer?: string;
          subscription?: string;
          metadata?: { userId?: string };
        };

        if (session.subscription) {
          const subscription = await retrieveSubscription(String(session.subscription));
          await syncSubscriptionFromStripe(subscription, session.metadata?.userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as StripeSubscription;
        await syncSubscriptionFromStripe(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as StripeSubscription;
        await cancelSubscriptionByStripeSubscriptionId(subscription.id);
        await cancelSubscriptionByCustomerId(String(subscription.customer));
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
