import "server-only";

import { createCheckoutSession } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getValidatedCreditPack, isCreditPackKey } from "@/lib/portal/credit-packs";
import { assertPortalAccountAccess, PortalHttpError, requiredString, type PortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

async function assertActivePaidWorkspace(context: PortalContext, accountId: string) {
  await assertPortalAccountAccess(context, accountId);
  if (context.mode === "staff" && context.staffRole === "owner") {
    throw new PortalHttpError(400, "Owner test access does not need a paid credit purchase. Use an audited owner grant for testing.");
  }
  const rows = await supabaseServiceRoleRequest<Array<{ status: string }>>(
    `/rest/v1/wovo_portal_subscriptions?select=status&account_id=eq.${encodeURIComponent(accountId)}&status=in.(active,trialing)&limit=1`,
  ).catch(() => []);
  if (!rows?.[0]) throw new PortalHttpError(402, "An active paid WOVO workspace is required before purchasing credits.");
}

export async function startCreditCheckout(request: Request, context: PortalContext, body: Record<string, unknown>) {
  const accountId = requiredString(body.accountId, "Workspace", 80);
  await assertActivePaidWorkspace(context, accountId);
  if (!isCreditPackKey(body.packKey)) throw new PortalHttpError(400, "Choose a valid WOVO credit pack.");
  const pack = await getValidatedCreditPack(body.packKey);
  if (!pack) throw new PortalHttpError(503, "Credit purchasing is paused because the Stripe price no longer matches WOVO's server allowlist.");
  const customerId = await ensureStripeCustomerForUser(context.user.id, context.user.email);
  const base = siteUrl(request);
  const session = await createCheckoutSession({
    customerId,
    priceId: pack.priceId,
    userId: context.user.id,
    successUrl: `${base}/portal?credits=success`,
    cancelUrl: `${base}/portal?credits=canceled`,
    mode: "payment",
    metadata: {
      product: "wovo_portal",
      portalPurchaseType: "credit_pack",
      portalAccountId: accountId,
      portalCreditPackKey: pack.key,
      portalCreditUnits: String(pack.units),
    },
  });
  if (!session.url) throw new PortalHttpError(502, "Stripe did not return a Checkout URL.");
  await supabaseServiceRoleRequest("/rest/v1/wovo_credit_checkout_sessions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      account_id: accountId,
      initiated_by: context.user.id,
      pack_key: pack.key,
      units: pack.units,
      amount_cents: pack.amountCents,
      stripe_price_id: pack.priceId,
      stripe_checkout_session_id: session.id,
      status: "pending",
    }),
  });
  return { url: session.url, pack: { key: pack.key, units: pack.units, amountCents: pack.amountCents } };
}
