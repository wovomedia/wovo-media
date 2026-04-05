import { NextResponse } from "next/server";
import { retrieveSubscription, updateSubscriptionPrice } from "@/lib/stripe";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { getAllowedSubscriptionPriceIds, getPlanConfig, getPlanFromPriceId, WOVO_AI_PRICES } from "@/lib/wovo-ai/plans";

type Body = { priceId?: string; plan?: "starter" | "growth" | "pro" };

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as Body;
    const newPriceId = (body.priceId ?? (body.plan ? WOVO_AI_PRICES[body.plan] : "") ?? "").trim();
    if (!getAllowedSubscriptionPriceIds().includes(newPriceId)) return NextResponse.json({ error: "Invalid plan price id." }, { status: 400 });
    const rows = await supabaseServiceRoleRequest<Array<{ stripe_subscription_id: string | null }>>(`/rest/v1/profiles?select=stripe_subscription_id&user_id=eq.${user.id}&limit=1`);
    const subscriptionId = rows?.[0]?.stripe_subscription_id;
    if (!subscriptionId) return NextResponse.json({ error: "No active subscription found." }, { status: 400 });
    const subscription = await retrieveSubscription(subscriptionId);
    const itemId = subscription.items?.data?.[0]?.id;
    if (!itemId) return NextResponse.json({ error: "Missing Stripe subscription item." }, { status: 400 });
    const updated = await updateSubscriptionPrice(subscriptionId, itemId, newPriceId);
    const plan = getPlanFromPriceId(newPriceId);
    if (plan) {
      await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${user.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stripe_subscription_id: updated.id, stripe_subscription_item_id: updated.items?.data?.[0]?.id ?? itemId, plan, monthly_limit: getPlanConfig(plan).monthlyCredits, updated_at: new Date().toISOString() }),
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unable to verify session")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upgrade." }, { status: 500 });
  }
}
