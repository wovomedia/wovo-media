const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) throw new Error("STRIPE_SECRET_KEY is required.");
if (!secret.startsWith("sk_live_")) throw new Error("Cartoon Episodes must be configured in the verified live WOVO Stripe account.");

const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" };
async function stripe(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, { headers, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `Stripe returned HTTP ${response.status}.`);
  return payload;
}

const products = await stripe("/products?active=true&limit=100");
let product = (products.data ?? []).find((item) => item.metadata?.wovo_product === "cartoon_series");
if (!product) {
  product = await stripe("/products", { method: "POST", body: new URLSearchParams({
    name: "WOVO Cartoon Episodes",
    description: "Three short, custom cartoon episode drafts each week with a client-approved character, script, vertical clip, caption, private review queue, and strict rights and likeness controls. Social publishing requires a separately connected official account.",
    "images[0]": "https://wovomedia.com/apple-icon.png",
    "metadata[wovo_product]": "cartoon_series",
  }) });
}

const lookupKey = "wovo_cartoon_series_monthly_3999_v1";
const prices = await stripe(`/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=10`);
let price = prices.data?.[0];
if (price) {
  if (price.product !== product.id || price.currency !== "usd" || price.unit_amount !== 3999 || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1) {
    throw new Error(`Stripe lookup key ${lookupKey} exists with different terms.`);
  }
} else {
  price = await stripe("/prices", { method: "POST", body: new URLSearchParams({
    product: product.id,
    currency: "usd",
    unit_amount: "3999",
    "recurring[interval]": "month",
    "recurring[interval_count]": "1",
    lookup_key: lookupKey,
    "metadata[wovo_product]": "cartoon_series",
    "metadata[wovo_price_version]": "2026-08-12",
  }) });
}

console.log(JSON.stringify({
  createdOrVerified: { WOVO_CARTOON_SERIES_MONTHLY_PRICE_ID: price.id },
  productId: product.id,
  customerSubscriptionsChanged: false,
}, null, 2));
