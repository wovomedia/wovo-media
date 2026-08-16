import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import type { StripeSubscription } from "@/lib/stripe";
import { isAllowedPortalSubscriptionPriceId } from "@/lib/portal/billing-options";
import { getAiOperatorPriceAllowlist } from "@/lib/portal/ai-operator";
import { cartoonSeriesPriceAllowlist } from "@/lib/portal/cartoon-series";

type PortalCheckoutSession = {
  id: string;
  customer?: string | null;
  subscription?: string | null;
  payment_intent?: string | null;
  metadata?: {
    userId?: string;
    product?: string;
    portalAccountId?: string;
    portalOrderId?: string;
    portalPurchaseType?: string;
    portalBillingFrequency?: string;
    portalEntitlementKey?: string;
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
}
