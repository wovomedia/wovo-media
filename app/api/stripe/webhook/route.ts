import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { retrieveSubscription, type StripeSubscription } from "@/lib/stripe";
import {
  cancelSubscriptionByCustomerId,
  cancelSubscriptionByStripeSubscriptionId,
  syncSubscriptionFromStripe,
  addExtraCredits,
  findUserIdByCustomerId,
} from "@/lib/wovo-ai/subscription";
import { CREDIT_PACK_MAP } from "@/lib/wovo-ai/plans";

export const runtime = "nodejs";

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

function isValidHexSignature(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

function verifySignature(payload: string, signatureHeader: string, secret: string): boolean {
  const elements = signatureHeader.split(",").map((entry) => entry.trim());
  const timestamp = elements.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = elements
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((signature) => {
    if (!isValidHexSignature(signature)) {
      return false;
    }

    const actualBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  });
}

export function verifySignatureTestHarness(): {
  singleSignaturePasses: boolean;
  secondSignaturePasses: boolean;
  malformedSignaturesFail: boolean;
} {
  const payload = '{"id":"evt_test"}';
  const secret = "whsec_test";
  const timestamp = "1730000000";
  const signedPayload = `${timestamp}.${payload}`;
  const correctSignature = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const singleSignatureHeader = `t=${timestamp},v1=${correctSignature}`;
  const secondSignatureHeader = `t=${timestamp},v1=${"0".repeat(64)},v1=${correctSignature}`;
  const malformedSignatureHeader = `t=${timestamp},v1=not-hex-value,v1=abcd`;

  return {
    singleSignaturePasses: verifySignature(payload, singleSignatureHeader, secret),
    secondSignaturePasses: verifySignature(payload, secondSignatureHeader, secret),
    malformedSignaturesFail: !verifySignature(payload, malformedSignatureHeader, secret),
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
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
          subscription?: string;
          customer?: string;
          metadata?: { userId?: string; purchaseType?: string; creditPackPriceId?: string };
        };

        if (session.subscription) {
          const subscription = await retrieveSubscription(String(session.subscription));
          await syncSubscriptionFromStripe(subscription, session.metadata?.userId);
        } else if (session.metadata?.purchaseType === "extra_credits") {
          const userId = session.metadata?.userId ?? (session.customer ? await findUserIdByCustomerId(String(session.customer)) : null);
          const creditsToAdd = CREDIT_PACK_MAP[session.metadata?.creditPackPriceId ?? ""] ?? 0;
          if (userId && creditsToAdd > 0) {
            await addExtraCredits(userId, creditsToAdd);
          }
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
      case "invoice.paid": {
        const invoice = event.data.object as { subscription?: string | null };
        if (invoice.subscription) {
          const subscription = await retrieveSubscription(String(invoice.subscription));
          await syncSubscriptionFromStripe(subscription);
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
