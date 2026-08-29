const secret = process.env.STRIPE_SECRET_KEY?.trim();
let legacyPriceId = process.env.WOVO_PORTAL_MONTHLY_PRICE_ID?.trim();
if (!secret) throw new Error("STRIPE_SECRET_KEY is required.");

const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" };
async function stripe(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, { headers, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `Stripe returned HTTP ${response.status}.`);
  return payload;
}

if (!legacyPriceId) {
  const prices = await stripe("/prices?active=true&type=recurring&limit=100&expand[]=data.product");
  const candidates = (prices.data ?? []).filter((price) => {
    const productName = typeof price.product === "object" ? price.product?.name ?? "" : "";
    return price.livemode && price.currency === "usd" && price.unit_amount === 3999 && price.recurring?.interval === "month" && price.recurring?.interval_count === 1 && productName === "WOVO Workspace";
  });
  if (candidates.length !== 1) throw new Error(`Expected exactly one live WOVO recurring price; found ${candidates.length}.`);
  legacyPriceId = candidates[0].id;
}

const legacy = await stripe(`/prices/${encodeURIComponent(legacyPriceId)}?expand[]=product`);
if (!legacy.livemode || legacy.currency !== "usd" || legacy.recurring?.interval !== "month" || legacy.recurring?.interval_count !== 1) {
  throw new Error("The current WOVO price is not a live monthly recurring price.");
}
const productId = typeof legacy.product === "string" ? legacy.product : legacy.product?.id;
if (!productId) throw new Error("The current WOVO price has no reusable Stripe product.");
await stripe(`/products/${encodeURIComponent(productId)}`, {
  method: "POST",
  body: new URLSearchParams({
    name: "WOVO Workspace",
    description: "Private marketing workspace with brand profile, weekly content planning, approval queue, calendar, private asset library, and shared WOVO support inbox.",
    "images[0]": "https://wovomedia.com/apple-icon.png",
    "metadata[wovo_product]": "workspace",
  }),
});

const definitions = [
  { key: "wovo_workspace_monthly_4499_v2", amount: 4499, interval: "month", count: 1, env: "WOVO_PORTAL_MONTHLY_PRICE_ID" },
  { key: "wovo_workspace_quarterly_11997_v2", amount: 11997, interval: "month", count: 3, env: "WOVO_PORTAL_QUARTERLY_PRICE_ID" },
  { key: "wovo_workspace_semiannual_20994_v2", amount: 20994, interval: "month", count: 6, env: "WOVO_PORTAL_SEMIANNUAL_PRICE_ID" },
  { key: "wovo_workspace_yearly_35988_v2", amount: 35988, interval: "year", count: 1, env: "WOVO_PORTAL_YEARLY_PRICE_ID" },
];

const result = {};
for (const definition of definitions) {
  const existing = await stripe(`/prices?lookup_keys[]=${encodeURIComponent(definition.key)}&active=true&limit=10`);
  let price = existing.data?.[0];
  if (price) {
    if (price.product !== productId || price.currency !== "usd" || price.unit_amount !== definition.amount || price.recurring?.interval !== definition.interval || price.recurring?.interval_count !== definition.count) {
      throw new Error(`Stripe lookup key ${definition.key} already exists with different billing terms.`);
    }
  } else {
    const body = new URLSearchParams({
      product: productId,
      currency: "usd",
      unit_amount: String(definition.amount),
      "recurring[interval]": definition.interval,
      "recurring[interval_count]": String(definition.count),
      lookup_key: definition.key,
      "metadata[wovo_product]": "workspace",
      "metadata[wovo_price_version]": "2026-08-29",
    });
    price = await stripe("/prices", { method: "POST", body });
  }
  result[definition.env] = price.id;
}

console.log(JSON.stringify({
  createdOrVerified: result,
  grandfatheredPriceId: legacyPriceId,
  productId,
  customerSubscriptionsChanged: false,
}, null, 2));
