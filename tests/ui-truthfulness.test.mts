import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const pricing = readFileSync("app/pricing/PricingExperience.tsx", "utf8");
const pricingCatalog = readFileSync("lib/portal/pricing-catalog.ts", "utf8");
const portal = readFileSync("app/portal/page.tsx", "utf8");
const terms = readFileSync("app/terms-of-use/page.tsx", "utf8");
const cancellation = readFileSync("app/cancellation-refund-policy/page.tsx", "utf8");
const stripe = readFileSync("lib/stripe.ts", "utf8");
const composer = readFileSync("app/WovoCreateExperience.tsx", "utf8");
const health = readFileSync("app/api/health/portal/route.ts", "utf8");

test("public and owner UI describes the live four-period billing catalog", () => {
  for (const source of [pricingCatalog, portal, terms, cancellation]) {
    assert.match(source, /six-month|every 6 months|semiannual/);
  }
  assert.match(pricing, /No subscription required/);
  assert.match(home, /WovoCreateExperience/);
  assert.match(terms, /without a recurring subscription/);
  assert.match(cancellation, /One-time credit packs do not renew/);
  assert.match(stripe, /args\.mode === "subscription"/);
  assert.match(stripe, /One-time purchase\. WOVO credits do not renew/);
});

test("the owner operations product stays deleted", () => {
  assert.doesNotMatch(portal, /OwnerOperations|ownerWorkspaceMode|Back to operations/);
  assert.doesNotMatch(portal, /<CartoonSeries|<AiOperator/);
  for (const gone of [
    "app/portal/OwnerOperations.tsx",
    "app/portal/AdamOperations.tsx",
    "app/portal/OwnerPublishingCenter.tsx",
    "app/portal/OwnerMetaConnection.tsx",
    "app/portal/AiOperator.tsx",
    "app/portal/CartoonSeries.tsx",
  ]) {
    assert.equal(existsSync(gone), false, `${gone} came back`);
  }
});

test("no interface claims an owner credit exemption", () => {
  assert.doesNotMatch(portal, /owner_exempt/);
  assert.doesNotMatch(portal, /Unlimited internal creation/);
});

test("the composer never offers a creation type the server has switched off", () => {
  // Every type is advertised only when its provider keys and feature flag are
  // set, so a visitor is never quoted a price for work WOVO cannot do.
  assert.match(home, /WOVO_VIDEO_GENERATION_ENABLED/);
  assert.match(home, /WOVO_MUSIC_GENERATION_ENABLED/);
  assert.match(home, /WOVO_CARTOON_VIDEO_ENABLED/);
  assert.match(home, /OPENAI_API_KEY/);
  assert.match(home, /FAL_API_KEY|FAL_KEY/);
  assert.match(composer, /typeAvailable/);
  assert.match(composer, /if \(!typeAvailable\)/);
  assert.match(composer, /disabled=\{!enabled\}/);
});

test("the health endpoint reports each subsystem independently and counts the real catalog", () => {
  // It used to expect exactly four prices and report the database as down
  // whenever price validation failed, which could never pass once the catalog
  // grew to three plans across four terms.
  assert.match(health, /WOVO_PLAN_TERMS\.length/);
  assert.doesNotMatch(health, /length === 4/);
  assert.match(health, /expectedPrices/);
  assert.match(health, /validatedPrices/);
});
