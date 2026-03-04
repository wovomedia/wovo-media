import { createStripeCustomer } from "@/lib/stripe";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

type ProfileBillingRow = {
  stripe_customer_id: string | null;
};

export async function ensureStripeCustomerForUser(userId: string, email?: string): Promise<string> {
  const rows = await supabaseServiceRoleRequest<ProfileBillingRow[]>(
    `/rest/v1/profiles?select=stripe_customer_id&user_id=eq.${userId}&limit=1`,
  );

  let stripeCustomerId = rows?.[0]?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const safeEmail = (email ?? "").trim() || `user-${userId}@wovo.local`;
    const customer = await createStripeCustomer(safeEmail, userId);
    stripeCustomerId = customer.id;

    await supabaseServiceRoleRequest(`/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  return stripeCustomerId;
}
