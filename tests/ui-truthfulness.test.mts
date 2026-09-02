import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const pricing = readFileSync("app/pricing/PricingExperience.tsx", "utf8");
const pricingCatalog = readFileSync("lib/portal/pricing-catalog.ts", "utf8");
const portal = readFileSync("app/portal/page.tsx", "utf8");
const owner = readFileSync("app/portal/OwnerOperations.tsx", "utf8");
const terms = readFileSync("app/terms-of-use/page.tsx", "utf8");
const cancellation = readFileSync("app/cancellation-refund-policy/page.tsx", "utf8");
const metaConnection = readFileSync("app/portal/OwnerMetaConnection.tsx", "utf8");
const publishingCenter = readFileSync("app/portal/OwnerPublishingCenter.tsx", "utf8");

test("public and owner UI describes the live four-period billing catalog", () => {
  for (const source of [pricingCatalog, portal, terms, cancellation]) {
    assert.match(source, /six-month|every 6 months|semiannual/);
  }
  assert.match(pricing, /No subscription required/);
  assert.match(home, /WovoCreateExperience/);
  assert.match(terms, /without a recurring subscription/);
  assert.match(cancellation, /One-time credit packs do not renew/);
});

test("owner settings describe native publishing truthfully and expose diagnostics", () => {
  assert.doesNotMatch(owner, /Native Facebook\/Instagram publishing is not enabled/);
  assert.match(owner, /Verified Facebook Pages and Instagram professional accounts/);
  assert.match(owner, /href="\/admin\/integrations"/);
  assert.match(owner, /Customers cannot access it/);
});

test("owner automation is video-first and remains review-before-schedule", () => {
  assert.match(metaConnection, /Automatic AI video drafts/);
  assert.match(metaConnection, /appear in Verifying/);
  assert.match(metaConnection, /Generate today’s video draft/);
  assert.doesNotMatch(metaConnection, /publish_image_test|Automatic image publishing/);
  assert.match(publishingCenter, /<video/);
  assert.match(publishingCenter, /Verify &amp; approve/);
  assert.match(publishingCenter, /Schedule post/);
  assert.doesNotMatch(portal, /<CartoonSeries|<AiOperator/);
});
