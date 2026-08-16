const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) throw new Error("STRIPE_SECRET_KEY is required.");

const definitions = [
  ["monthly", process.env.WOVO_VERIFY_MONTHLY_PRICE_ID, Number(process.env.WOVO_VERIFY_MONTHLY_AMOUNT ?? 1500)],
  ["quarterly", process.env.WOVO_VERIFY_QUARTERLY_PRICE_ID, Number(process.env.WOVO_VERIFY_QUARTERLY_AMOUNT ?? 3600)],
  ["yearly", process.env.WOVO_VERIFY_YEARLY_PRICE_ID, Number(process.env.WOVO_VERIFY_YEARLY_AMOUNT ?? 12000)],
];
if (definitions.some(([, id]) => !id)) throw new Error("All three WOVO_VERIFY_*_PRICE_ID values are required.");

const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" };
async function stripe(path, body, method = "POST") {
  const response = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `Stripe returned HTTP ${response.status}.`);
  return payload;
}

const customer = await stripe("/customers", new URLSearchParams({
  email: `checkout-verification-${Date.now()}@example.com`,
  description: "Temporary WOVO checkout verification customer",
  "metadata[wovo_nonfinancial_test]": "true",
}));

const sessions = [];
try {
  for (const [frequency, priceId, expectedAmount] of definitions) {
    const body = new URLSearchParams({
      mode: "subscription",
      customer: customer.id,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: "https://wovomedia.com/portal?checkout=success",
      cancel_url: "https://wovomedia.com/portal?checkout=canceled",
      submit_type: "subscribe",
      "metadata[product]": process.env.WOVO_VERIFY_PRODUCT ?? "wovo_portal",
      "metadata[portalBillingFrequency]": frequency,
      "branding_settings[display_name]": "WOVO Media",
      "branding_settings[background_color]": "#FFFDF8",
      "branding_settings[button_color]": "#D94326",
      "custom_text[submit][message]": "Renews at the price and cadence shown until canceled. Manage future renewal from WOVO Billing. Cancellation and refund terms: wovomedia.com/cancellation-refund-policy.",
      "custom_text[after_submit][message]": "Access activates after Stripe confirms payment. Manage billing and future cancellation from your WOVO workspace.",
    });
    const session = await stripe("/checkout/sessions", body);
    if (session.amount_total !== expectedAmount || session.mode !== "subscription" || session.payment_status !== "unpaid") {
      throw new Error(`${frequency} Checkout Session returned unexpected financial terms.`);
    }
    sessions.push(session);
  }
  console.log(JSON.stringify(sessions.map((session, index) => ({
    frequency: definitions[index][0],
    amountTotal: session.amount_total,
    currency: session.currency,
    mode: session.mode,
    paymentStatus: session.payment_status,
    checkoutStatus: session.status,
  })), null, 2));
} finally {
  for (const session of sessions) {
    await stripe(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, new URLSearchParams()).catch(() => null);
  }
  await stripe(`/customers/${encodeURIComponent(customer.id)}`, undefined, "DELETE").catch(() => null);
}
