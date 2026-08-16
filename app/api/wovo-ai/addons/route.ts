import { NextResponse } from "next/server";
import { createCheckoutSession, retrievePrice } from "@/lib/stripe";
import { requireServerUser } from "@/lib/supabase/server";
import { ensureStripeCustomerForUser } from "@/lib/wovo-ai/billing";
import { getAddon, getAvailableAddons, hasActiveAddon, type AddonKey } from "@/lib/wovo-ai/addons";

function getSiteUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${proto}://${forwardedHost}` : url.origin;
}

function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))
  );
}

function isKnownAddonKey(value: string): value is AddonKey {
  return getAvailableAddons().some((addon) => addon.key === value);
}

/** Catalog plus the caller's current entitlements. */
export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const customerId = await ensureStripeCustomerForUser(String(user.id), user.email);
    const available = getAvailableAddons();

    const addons = await Promise.all(
      available.map(async (addon) => ({
        key: addon.key,
        label: addon.label,
        monthlyPrice: addon.monthlyPrice,
        description: addon.description,
        active: await hasActiveAddon(customerId, addon.key),
      })),
    );

    return NextResponse.json({ addons });
  } catch (error) {
    if (isAuthError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load add-ons." },
      { status: 500 },
    );
  }
}

/** Starts Stripe Checkout for an add-on subscription. */
export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json().catch(() => ({}))) as { addon?: string };
    const requested = (body.addon ?? "").trim();

    if (!requested || !isKnownAddonKey(requested)) {
      // Also the path taken when the add-on exists but has no Stripe price
      // configured yet, since getAvailableAddons() filters those out.
      return NextResponse.json({ error: "That add-on is not available." }, { status: 400 });
    }

    const addon = getAddon(requested);
    const price = await retrievePrice(addon.priceId).catch(() => null);
    if (!price?.active || price.currency !== "usd" || price.unit_amount !== 199 || price.recurring?.interval !== "month") {
      return NextResponse.json({ error: "The configured DM drafting add-on is not a verified active $1.99 monthly price." }, { status: 503 });
    }
    const customerId = await ensureStripeCustomerForUser(String(user.id), user.email);

    if (await hasActiveAddon(customerId, addon.key)) {
      return NextResponse.json({ error: "You already have this add-on." }, { status: 409 });
    }

    const siteUrl = getSiteUrl(request);
    const session = await createCheckoutSession({
      customerId,
      priceId: addon.priceId,
      userId: String(user.id),
      successUrl: `${siteUrl}/portal?addon=${addon.key}&success=1`,
      cancelUrl: `${siteUrl}/portal?addon=${addon.key}`,
      mode: "subscription",
      // No trial: this is a $1.99 add-on, and a trial on top of the core
      // subscription's own trial makes the billing timeline hard to explain.
      metadata: {
        addonKey: addon.key,
        purchaseKind: "addon",
        email: user.email ?? "",
        userId: String(user.id),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isAuthError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start add-on checkout." },
      { status: 500 },
    );
  }
}
