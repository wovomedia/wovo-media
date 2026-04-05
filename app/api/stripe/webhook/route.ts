import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { retrieveSubscription, type StripeSubscription } from "@/lib/stripe";
import { cancelSubscriptionByCustomerId, cancelSubscriptionByStripeSubscriptionId, syncSubscriptionFromStripe, addExtraCredits, findUserIdByCustomerId } from "@/lib/wovo-ai/subscription";
import { CREDIT_PACK_MAP } from "@/lib/wovo-ai/plans";

export const runtime = "nodejs";

type StripeEvent = { type: string; data: { object: Record<string, unknown> } };

function verifySignature(payload: string, sigHeader: string, secret: string): boolean {
  const parts = sigHeader.split(",").map((s) => s.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || sigs.length === 0) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return sigs.some((sig) => {
    if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length % 2 !== 0) return false;
    const actualBuf = Buffer.from(sig, "hex");
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  const body = await request.text();
  if (!verifySignature(body, sig, webhookSecret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  let event: StripeEvent;
  try { event = JSON.parse(body) as StripeEvent; } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { subscription?: string; customer?: string; metadata?: { userId?: string; purchaseType?: string; creditPackPriceId?: string } };
        if (session.subscription) {
          const sub = await retrieveSubscription(String(session.subscription));
          await syncSubscriptionFromStripe(sub, session.metadata?.userId);
        } else if (session.metadata?.purchaseType === "extra_credits") {
          const userId = session.metadata?.userId ?? (session.customer ? await findUserIdByCustomerId(String(session.customer)) : null);
          const credits = CREDIT_PACK_MAP[session.metadata?.creditPackPriceId ?? ""] ?? 0;
          if (userId && credits > 0) await addExtraCredits(userId, credits);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscriptionFromStripe(event.data.object as unknown as StripeSubscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        await cancelSubscriptionByStripeSubscriptionId(sub.id);
        await cancelSubscriptionByCustomerId(String(sub.customer));
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
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook handler failed." }, { status: 500 });
  }
}
