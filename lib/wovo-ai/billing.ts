import { createStripeCustomer } from "@/lib/stripe";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

export async function ensureStripeCustomerForUser(userId: string, email?: string): Promise<string> {
  const rows = await supabaseServiceRoleRequest<SubscriptionRow[]>(
    `/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${userId}&limit=1`,
  );

  let stripeCustomerId = rows?.[0]?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const safeEmail = (email ?? "").trim() || `user-${userId}@wovo.local`;
    const customer = await createStripeCustomer(safeEmail, userId);
    stripeCustomerId = customer.id;

    await supabaseServiceRoleRequest("/rest/v1/subscriptions?on_conflict=user_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  return stripeCustomerId;
}
