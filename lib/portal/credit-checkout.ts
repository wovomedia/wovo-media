import "server-only";

import { createCheckoutSession, createCreditAmountCheckoutSession } from "@/lib/stripe";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getValidatedCreditPack, isCreditPackKey } from "@/lib/portal/credit-packs";
import { assertPortalAccountAccess, PortalHttpError, requiredString, type PortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { creditPackUnitsForDollars } from "@/lib/portal/pricing-catalog";

function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

async function assertWorkspaceAccess(context: PortalContext, accountId: string) {
  await assertPortalAccountAccess(context, accountId);
}

export async function startCreditCheckout(request: Request, context: PortalContext, body: Record<string, unknown>) {
  const accountId = requiredString(body.accountId, "Workspace", 80);
  await assertWorkspaceAccess(context, accountId);
  const fixedPack = isCreditPackKey(body.packKey) ? await getValidatedCreditPack(body.packKey) : null;
  const rawAmount = Number(body.amountDollars);
  const customAmountDollars = Number.isInteger(rawAmount) && rawAmount >= 10 && rawAmount <= 10_000 ? rawAmount : null;
  if (!fixedPack && customAmountDollars === null) throw new PortalHttpError(400, "Choose a verified pack or enter a whole-dollar amount from $10 to $10,000.");
  const amountCents = fixedPack?.amountCents ?? customAmountDollars! * 100;
  const units = fixedPack?.units ?? creditPackUnitsForDollars(customAmountDollars!);
  const packKey = fixedPack?.key ?? `custom_${customAmountDollars}`;
  const customerId = await ensureStripeCustomerForUser(context.user.id, context.user.email);
  const base = siteUrl(request);
  const metadata = {
      product: "wovo_portal",
      portalPurchaseType: "credit_pack",
      portalAccountId: accountId,
      portalCreditPackKey: packKey,
      portalCreditUnits: String(units),
      portalCreditAmountCents: String(amountCents),
  };
  const session = fixedPack
    ? await createCheckoutSession({ customerId, priceId: fixedPack.priceId, userId: context.user.id, successUrl: `${base}/portal?credits=success`, cancelUrl: `${base}/portal?credits=canceled`, mode: "payment", metadata })
    : await createCreditAmountCheckoutSession({ customerId, amountCents, creditUnits: units, userId: context.user.id, successUrl: `${base}/portal?credits=success`, cancelUrl: `${base}/portal?credits=canceled`, metadata });
  if (!session.url) throw new PortalHttpError(502, "Stripe did not return a Checkout URL.");
  await supabaseServiceRoleRequest("/rest/v1/wovo_credit_checkout_sessions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      account_id: accountId,
      initiated_by: context.user.id,
      pack_key: packKey,
      units,
      amount_cents: amountCents,
      stripe_price_id: fixedPack?.priceId ?? "dynamic",
      stripe_checkout_session_id: session.id,
      status: "pending",
    }),
  });
  return { url: session.url, pack: { key: packKey, units, amountCents } };
}
