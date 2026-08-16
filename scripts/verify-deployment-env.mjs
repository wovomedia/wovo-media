const production = process.env.VERCEL_ENV === "production";

if (!production) {
  console.log("Production environment preflight skipped outside Vercel Production.");
  process.exit(0);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Production environment preflight failed: ${name} is missing.`);
  return value;
}

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const supabaseServerKey = (
  process.env.SUPABASE_SECRET_KEY?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
);
if (!supabaseServerKey) {
  throw new Error("Production environment preflight failed: a Supabase server key is missing.");
}

const stripeKey = required("STRIPE_SECRET_KEY");
required("STRIPE_WEBHOOK_SECRET");
const ownerEmail = required("WOVO_OWNER_EMAIL").toLowerCase();
const portalPrices = [
  ["WOVO_PORTAL_MONTHLY_PRICE_ID", 1500, "month", 1],
  ["WOVO_PORTAL_QUARTERLY_PRICE_ID", 3600, "month", 3],
  ["WOVO_PORTAL_YEARLY_PRICE_ID", 12000, "year", 1],
];
const operatorCheckoutEnabled = process.env.WOVO_AI_OPERATOR_CHECKOUT_ENABLED?.trim() === "true";
const operatorPrices = operatorCheckoutEnabled
  ? [
      ["WOVO_AI_OPERATOR_MONTHLY_PRICE_ID", 19900, "month", 1],
      ["WOVO_AI_OPERATOR_QUARTERLY_PRICE_ID", 37500, "month", 3],
      ["WOVO_AI_OPERATOR_YEARLY_PRICE_ID", 102000, "year", 1],
    ]
  : [];
const cartoonCheckoutEnabled = process.env.WOVO_CARTOON_SERIES_CHECKOUT_ENABLED?.trim() === "true";
const cartoonPrices = cartoonCheckoutEnabled
  ? [["WOVO_CARTOON_SERIES_MONTHLY_PRICE_ID", 3999, "month", 1]]
  : [];
if (cartoonCheckoutEnabled && process.env.WOVO_CARTOON_VIDEO_ENABLED?.trim() !== "true") {
  throw new Error("Production environment preflight failed: Cartoon checkout cannot be enabled before production video generation is enabled and verified.");
}
const outreachEnabled = process.env.WOVO_OUTREACH_ENABLED?.trim() === "true";
if (outreachEnabled) {
  required("RESEND_API_KEY");
  required("RESEND_WEBHOOK_SECRET");
  const unsubscribeSecret = required("WOVO_OUTREACH_UNSUBSCRIBE_SECRET");
  if (!/^[a-f0-9]{64}$/i.test(unsubscribeSecret)) {
    throw new Error("Production environment preflight failed: WOVO_OUTREACH_UNSUBSCRIBE_SECRET must be a 32-byte hexadecimal key.");
  }
  if (required("WOVO_ADAM_OUTREACH_SENDER").toLowerCase() !== "adam@wovomedia.com") {
    throw new Error("Production environment preflight failed: Adam outreach must use the approved adam@wovomedia.com sender.");
  }
}
const metaPublishingEnabled = process.env.WOVO_META_PUBLISHING_ENABLED?.trim() === "true";
if (metaPublishingEnabled) {
  required("META_APP_ID");
  required("META_APP_SECRET");
  required("META_LOGIN_CONFIG_ID");
  const metaTokenKey = required("META_TOKEN_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(metaTokenKey)) throw new Error("Production environment preflight failed: META_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  required("CRON_SECRET");
}
required("WOVO_PORTAL_GRANDFATHERED_PRICE_IDS");
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim()
  || process.env.NEXT_PUBLIC_APP_URL?.trim()
);
if (siteUrl !== "https://wovomedia.com") {
  throw new Error("Production environment preflight failed: canonical site URL must be https://wovomedia.com.");
}
if (!stripeKey.startsWith("sk_live_")) {
  throw new Error("Production environment preflight failed: Stripe is not using a live secret key.");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
  throw new Error("Production environment preflight failed: WOVO_OWNER_EMAIL is invalid.");
}

const supabaseHeaders = { apikey: supabaseServerKey };
if (!supabaseServerKey.startsWith("sb_secret_")) {
  supabaseHeaders.Authorization = `Bearer ${supabaseServerKey}`;
}
const supabaseResponse = await fetch(
  `${supabaseUrl}/rest/v1/wovo_portal_accounts?select=id&limit=1`,
  { headers: supabaseHeaders }
);
if (!supabaseResponse.ok) {
  throw new Error(`Production environment preflight failed: Supabase server key validation returned HTTP ${supabaseResponse.status}.`);
}

for (const [name, amount, interval, intervalCount] of [...portalPrices, ...operatorPrices, ...cartoonPrices]) {
  const priceId = required(name);
  const priceResponse = await fetch(
    `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (!priceResponse.ok) {
    throw new Error(`Production environment preflight failed: ${name} lookup returned HTTP ${priceResponse.status}.`);
  }
  const price = await priceResponse.json();
  if (
    price.active !== true
    || price.livemode !== true
    || price.currency !== "usd"
    || price.unit_amount !== amount
    || price.recurring?.interval !== interval
    || price.recurring?.interval_count !== intervalCount
  ) {
    throw new Error(`Production environment preflight failed: ${name} does not match the approved recurring WOVO price.`);
  }
}

console.log(`Production environment preflight passed: Supabase server access, canonical URL, Stripe live mode, webhook secret, all three approved WOVO billing periods${operatorCheckoutEnabled ? ", all three approved AI Operator billing periods" : ""}${cartoonCheckoutEnabled ? ", the approved $39.99 Cartoon Episodes price" : ""}${outreachEnabled ? ", and the complete Adam outreach safety gate" : ""}.`);
