import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import { retrieveCheckoutLineItems, type StripeSubscription } from "@/lib/stripe";
import { isAllowedPortalSubscriptionPriceId, planForPortalSubscriptionPriceId } from "@/lib/portal/billing-options";
import { getAiOperatorPriceAllowlist } from "@/lib/portal/ai-operator";
import { cartoonSeriesPriceAllowlist } from "@/lib/portal/cartoon-series";
import { creditPackForPriceId, getValidatedCreditPack, isCreditPackKey } from "@/lib/portal/credit-packs";

type PortalCheckoutSession = {
  id: string;
  customer?: string | null;
  subscription?: string | null;
  payment_intent?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: {
    userId?: string;
    product?: string;
    portalAccountId?: string;
    portalOrderId?: string;
    portalPurchaseType?: string;
    portalBillingFrequency?: string;
    portalEntitlementKey?: string;
    portalCreditPackKey?: string;
    portalCreditUnits?: string;
    portalCreditAmountCents?: string;
  } | null;
};

export async function beginPortalStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  const rows = await supabaseServiceRoleRequest<Array<{ event_id: string }>>(
    "/rest/v1/wovo_portal_stripe_events?on_conflict=event_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ event_id: eventId, event_type: eventType, status: "processing" }),
    }
  );
  return Boolean(rows?.length);
}

export async function finishPortalStripeEvent(eventId: string): Promise<void> {
  await supabaseServiceRoleRequest(
    `/rest/v1/wovo_portal_stripe_events?event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString(), error_message: null }),
    }
  );
}

export async function failPortalStripeEvent(eventId: string, message: string): Promise<void> {
  await supabaseServiceRoleRequest(
    `/rest/v1/wovo_portal_stripe_events?event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error_message: message.slice(0, 1000) }),
    }
  ).catch(() => null);
  await supabaseServiceRoleRequest(
    `/rest/v1/wovo_portal_stripe_events?event_id=eq.${encodeURIComponent(eventId)}&status=eq.failed`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  ).catch(() => null);
}

export async function handlePortalCheckoutCompleted(session: PortalCheckoutSession): Promise<void> {
  if (session.metadata?.product !== "wovo_portal") return;
  const accountId = session.metadata.portalAccountId;
  if (!accountId) throw new Error("Portal checkout is missing portalAccountId metadata.");
  const userId = session.metadata.userId;
  if (!userId) throw new Error("Portal checkout is missing authenticated user metadata.");
  const [members, staff] = await Promise.all([
    supabaseServiceRoleRequest<Array<{ account_id: string }>>(
      `/rest/v1/wovo_portal_members?select=account_id&account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`
    ).catch(() => []),
    supabaseServiceRoleRequest<Array<{ user_id: string }>>(
      `/rest/v1/wovo_portal_staff?select=user_id&user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`
    ).catch(() => []),
  ]);
  if (!members?.[0] && !staff?.[0]) {
    throw new Error("Portal checkout identity is not authorized for this workspace.");
  }

  if (session.metadata.portalPurchaseType === "credit_pack") {
    if (session.payment_status !== "paid") return;
    const lineItems = await retrieveCheckoutLineItems(session.id);
    const priceIds = lineItems.map((item) => item.price?.id).filter((id): id is string => Boolean(id));
    if (priceIds.length !== 1) throw new Error("Credit Checkout must contain exactly one allowlisted price.");
    const metadataAmount = Number(session.metadata.portalCreditAmountCents);
    const metadataUnits = Number(session.metadata.portalCreditUnits);
    if (Number.isInteger(metadataAmount) && metadataAmount >= 1000) {
      if (session.currency !== "usd" || session.amount_total !== metadataAmount || metadataAmount % 100 !== 0 || metadataUnits !== (metadataAmount / 100) * 11) {
        throw new Error("Credit Checkout amount or unit metadata did not match the paid Stripe total.");
      }
      const configuredPack = creditPackForPriceId(priceIds[0]);
      if (configuredPack) {
        const verifiedPack = await getValidatedCreditPack(configuredPack.key);
        if (!verifiedPack || verifiedPack.key !== session.metadata.portalCreditPackKey || verifiedPack.units !== metadataUnits || verifiedPack.amountCents !== metadataAmount) {
          throw new Error("Credit Checkout pack metadata does not match the server allowlist.");
        }
      } else if (session.metadata.portalCreditPackKey !== `custom_${metadataAmount / 100}`) {
        throw new Error("Custom credit Checkout metadata is invalid.");
      }
      await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_finalize_credit_purchase_v2", {
        method: "POST",
        body: JSON.stringify({
          p_account_id: accountId,
          p_initiated_by: userId,
          p_stripe_checkout_session_id: session.id,
          p_stripe_price_id: priceIds[0],
          p_amount_cents: metadataAmount,
          p_units: metadataUnits,
          p_stripe_payment_intent_id: session.payment_intent ?? null,
        }),
      });
      return;
    }
    // Complete older Checkout Sessions created before V2 without changing
    // their already-bound units or one-time price.
    const configuredPack = creditPackForPriceId(priceIds[0]);
    const metadataPack = session.metadata.portalCreditPackKey;
    if (!configuredPack || !isCreditPackKey(metadataPack) || configuredPack.key !== metadataPack) {
      throw new Error("Credit Checkout pack metadata does not match the server allowlist.");
    }
    const verifiedPack = await getValidatedCreditPack(configuredPack.key);
    if (!verifiedPack || Number(session.metadata.portalCreditUnits) !== verifiedPack.units) {
      throw new Error("Credit Checkout units or Stripe price validation failed.");
    }
    await supabaseServiceRoleRequest("/rest/v1/rpc/wovo_finalize_credit_purchase", {
      method: "POST",
      body: JSON.stringify({
        p_account_id: accountId,
        p_initiated_by: userId,
        p_stripe_checkout_session_id: session.id,
        p_stripe_price_id: priceIds[0],
        p_stripe_payment_intent_id: session.payment_intent ?? null,
      }),
    });
    return;
  }

  if (session.metadata.portalPurchaseType === "subscription" && session.subscription) {
    await supabaseServiceRoleRequest(
      "/rest/v1/wovo_portal_subscriptions?on_conflict=account_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          account_id: accountId,
          stripe_customer_id: session.customer ?? null,
          stripe_subscription_id: session.subscription,
          status: "inactive",
          updated_at: new Date().toISOString(),
        }),
      }
    );
  }

  if (session.metadata.portalPurchaseType === "ai_operator" && session.subscription) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_entitlements?on_conflict=account_id,entitlement_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        entitlement_key: "ai_operator",
        status: "checkout_pending",
        stripe_subscription_id: session.subscription,
        provisioning_status: "pending",
        updated_at: new Date().toISOString(),
      }),
    });
  }

  if (session.metadata.portalPurchaseType === "cartoon_series" && session.subscription) {
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_entitlements?on_conflict=account_id,entitlement_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        entitlement_key: "cartoon_series",
        status: "checkout_pending",
        stripe_subscription_id: session.subscription,
        provisioning_status: "pending",
        updated_at: new Date().toISOString(),
      }),
    });
  }

  const orderId = session.metadata.portalOrderId;
  if (orderId) {
    await supabaseServiceRoleRequest(
      `/rest/v1/wovo_portal_orders?id=eq.${encodeURIComponent(orderId)}&account_id=eq.${encodeURIComponent(accountId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "paid",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ?? null,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_notifications", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        notification_type: "payment_received",
        title: "Add-on payment received",
        target_role: "manager",
        related_table: "wovo_portal_orders",
        related_id: orderId,
      }),
    });
  }
}

export async function syncPortalSubscription(subscription: StripeSubscription & { metadata?: Record<string, string> }): Promise<void> {
  const accountFromMetadata = subscription.metadata?.portalAccountId;
  let accountId = accountFromMetadata ?? null;
  if (!accountId) {
    const rows = await supabaseServiceRoleRequest<Array<{ account_id: string }>>(
      `/rest/v1/wovo_portal_subscriptions?select=account_id&stripe_subscription_id=eq.${encodeURIComponent(subscription.id)}&limit=1`
    ).catch(() => []);
    accountId = rows?.[0]?.account_id ?? null;
  }
  if (!accountId) return;
  const itemPrice = subscription.items?.data?.[0]?.price?.id ?? null;
  if (subscription.metadata?.portalEntitlementKey === "ai_operator") {
    const allowed = Boolean(itemPrice && getAiOperatorPriceAllowlist().includes(itemPrice));
    const active = allowed && ["active", "trialing"].includes(subscription.status);
    const canceling = active && subscription.cancel_at_period_end;
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_entitlements?on_conflict=account_id,entitlement_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        entitlement_key: "ai_operator",
        status: canceling ? "canceling" : active ? "active" : subscription.status === "canceled" ? "canceled" : "inactive",
        stripe_subscription_id: subscription.id,
        stripe_price_id: itemPrice,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        provisioning_status: active ? "ready" : "not_started",
        updated_at: new Date().toISOString(),
      }),
    });
    return;
  }
  if (subscription.metadata?.portalEntitlementKey === "cartoon_series") {
    const allowed = Boolean(itemPrice && cartoonSeriesPriceAllowlist().includes(itemPrice));
    const active = allowed && ["active", "trialing"].includes(subscription.status);
    const canceling = active && subscription.cancel_at_period_end;
    await supabaseServiceRoleRequest("/rest/v1/wovo_portal_entitlements?on_conflict=account_id,entitlement_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        entitlement_key: "cartoon_series",
        status: canceling ? "canceling" : active ? "active" : subscription.status === "canceled" ? "canceled" : "inactive",
        stripe_subscription_id: subscription.id,
        stripe_price_id: itemPrice,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        provisioning_status: active ? "ready" : "not_started",
        updated_at: new Date().toISOString(),
      }),
    });
    return;
  }
  const allowedPrice = await isAllowedPortalSubscriptionPriceId(itemPrice);
  const plan = planForPortalSubscriptionPriceId(itemPrice);
  await supabaseServiceRoleRequest(
    "/rest/v1/wovo_portal_subscriptions?on_conflict=account_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_price_id: itemPrice,
        status: allowedPrice ? subscription.status : "inactive",
        current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  const activePlan = allowedPrice && plan && ["active", "trialing"].includes(subscription.status) ? plan : null;
  const existingPolicies = await supabaseServiceRoleRequest<Array<{ period_end: string; monthly_included_units: number }>>(
    `/rest/v1/wovo_ai_usage_policies?select=period_end,monthly_included_units&account_id=eq.${encodeURIComponent(accountId)}&limit=1`,
  ).catch(() => []);
  const existingPolicy = existingPolicies?.[0];
  const shouldStartWindow = !existingPolicy || Date.parse(existingPolicy.period_end) <= Date.now() || existingPolicy.monthly_included_units !== (activePlan?.monthlyCredits ?? 0);
  if (shouldStartWindow) {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    const monthlyCredits = activePlan?.monthlyCredits ?? 0;
    await supabaseServiceRoleRequest("/rest/v1/wovo_ai_usage_policies?on_conflict=account_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        account_id: accountId,
        enabled: true,
        plan_key: "core",
        daily_unit_limit: Math.max(20, monthlyCredits),
        weekly_unit_limit: Math.max(20, monthlyCredits),
        monthly_included_units: monthlyCredits,
        requests_per_minute: activePlan?.planId === "pro" ? 6 : activePlan?.planId === "creator" ? 4 : 2,
        monthly_provider_cost_cap_micros: activePlan?.planId === "pro" ? 8_000_000 : activePlan?.planId === "creator" ? 5_000_000 : activePlan ? 3_000_000 : 0,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        updated_at: periodStart.toISOString(),
      }),
    });
  }
}
