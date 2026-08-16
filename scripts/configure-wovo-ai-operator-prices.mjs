const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) throw new Error("STRIPE_SECRET_KEY is required.");
if (!secret.startsWith("sk_live_")) throw new Error("AI Operator prices must be created in the verified live WOVO Stripe account.");

const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" };
async function stripe(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, { headers, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `Stripe returned HTTP ${response.status}.`);
  return payload;
}

const products = await stripe("/products?active=true&limit=100");
let product = (products.data ?? []).find((item) => item.metadata?.wovo_product === "ai_operator");
if (!product) {
  product = await stripe("/products", { method: "POST", body: new URLSearchParams({
    name: "Your AI Operator",
    description: "A tenant-private WOVO AI assistant with a named business role, approved knowledge, bounded draft workflows, metered usage, and explicit action controls. It is software, not a human employee.",
    "images[0]": "https://wovomedia.com/apple-icon.png",
    "metadata[wovo_product]": "ai_operator",
  }) });
}

const definitions = [
  { key: "wovo_ai_operator_monthly_19900_v1", amount: 19900, interval: "month", count: 1, env: "WOVO_AI_OPERATOR_MONTHLY_PRICE_ID" },
  { key: "wovo_ai_operator_quarterly_37500_v1", amount: 37500, interval: "month", count: 3, env: "WOVO_AI_OPERATOR_QUARTERLY_PRICE_ID" },
  { key: "wovo_ai_operator_yearly_102000_v1", amount: 102000, interval: "year", count: 1, env: "WOVO_AI_OPERATOR_YEARLY_PRICE_ID" },
];

const result = {};
for (const definition of definitions) {
  const existing = await stripe(`/prices?lookup_keys[]=${encodeURIComponent(definition.key)}&active=true&limit=10`);
  let price = existing.data?.[0];
  if (price) {
    if (price.product !== product.id || price.currency !== "usd" || price.unit_amount !== definition.amount || price.recurring?.interval !== definition.interval || price.recurring?.interval_count !== definition.count) {
      throw new Error(`Stripe lookup key ${definition.key} exists with different terms.`);
    }
  } else {
    price = await stripe("/prices", { method: "POST", body: new URLSearchParams({
      product: product.id, currency: "usd", unit_amount: String(definition.amount),
      "recurring[interval]": definition.interval, "recurring[interval_count]": String(definition.count),
      lookup_key: definition.key, "metadata[wovo_product]": "ai_operator", "metadata[wovo_price_version]": "2026-08-10",
    }) });
  }
  result[definition.env] = price.id;
}

console.log(JSON.stringify({ createdOrVerified: result, productId: product.id, customerSubscriptionsChanged: false }, null, 2));
