import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RETAIL_CREDIT_FLOOR_MICROS,
  quoteMusicTrack,
  quoteShortVideo,
  quoteSocialPostImage,
} from "../lib/ai/provider-models.ts";
import { creditPackUnitsForDollars, WOVO_PLAN_TERMS } from "../lib/portal/pricing-catalog.ts";
import {
  maxMonthlyCreditsForMargin,
  planTermEconomics,
  WOVO_LAUNCH_COST_ASSUMPTIONS,
} from "../lib/portal/pricing-economics.ts";

const CONTRIBUTION_MARGIN_FLOOR_BPS = 7_000;

function worstProviderCostPerCreditMicros() {
  const quotes = [
    quoteSocialPostImage(),
    quoteShortVideo(false),
    quoteShortVideo(true),
    quoteMusicTrack("economy", 30),
    quoteMusicTrack("economy", 180),
    quoteMusicTrack("premium", 180),
  ];
  return Math.max(...quotes.map((quote) => quote.estimatedProviderCostMicros / quote.customerCredits));
}

test("the simulator's provider-cost assumption is not cheaper than any real quote", () => {
  const worst = worstProviderCostPerCreditMicros();
  assert.ok(
    WOVO_LAUNCH_COST_ASSUMPTIONS.providerCostPerCreditMicros >= worst,
    `assumption ${WOVO_LAUNCH_COST_ASSUMPTIONS.providerCostPerCreditMicros} is below the worst real quote ${worst}`,
  );
});

test("launch planning never counts unspent credits as margin", () => {
  assert.equal(WOVO_LAUNCH_COST_ASSUMPTIONS.utilization, 1);
});

test("every published plan and term clears the contribution floor with the allowance fully spent", () => {
  assert.equal(WOVO_PLAN_TERMS.length, 12);
  for (const option of WOVO_PLAN_TERMS) {
    const economics = planTermEconomics({
      monthlyCredits: option.monthlyCredits,
      amountCents: option.amountCents,
      monthsCovered: option.monthsCovered,
    });
    assert.ok(
      economics.contributionCentsPerMonth > 0,
      `${option.planId}/${option.frequency} loses money at full use`,
    );
    assert.ok(
      economics.contributionMarginBps >= CONTRIBUTION_MARGIN_FLOOR_BPS,
      `${option.planId}/${option.frequency} contribution margin ${economics.contributionMarginBps}bps is below the floor`,
    );
  }
});

test("no published allowance exceeds the simulated safe maximum for its own term", () => {
  for (const option of WOVO_PLAN_TERMS) {
    const safeMax = maxMonthlyCreditsForMargin(
      { amountCents: option.amountCents, monthsCovered: option.monthsCovered },
      CONTRIBUTION_MARGIN_FLOOR_BPS,
    );
    assert.ok(
      option.monthlyCredits <= safeMax,
      `${option.planId}/${option.frequency} grants ${option.monthlyCredits} credits but only ${safeMax} are safe`,
    );
  }
});

test("raising an allowance to the requested marketing range would break the floor", () => {
  const starterAnnual = WOVO_PLAN_TERMS.find(
    (option) => option.planId === "starter" && option.frequency === "annual",
  );
  assert.ok(starterAnnual);
  const stretched = planTermEconomics({
    monthlyCredits: 500,
    amountCents: starterAnnual.amountCents,
    monthsCovered: starterAnnual.monthsCovered,
  });
  assert.ok(
    stretched.contributionMarginBps < CONTRIBUTION_MARGIN_FLOOR_BPS,
    "500 Starter credits should not silently pass the floor",
  );
  assert.ok(stretched.contributionCentsPerMonth > 0, "500 Starter credits should still be gross-profitable");
});

// Every route a customer has to acquire a credit, as dollars of revenue per
// credit. Margin safety must be checked against the cheapest of these, never
// against the most expensive plan.
function lowestRevenuePerCredit() {
  const subscriptions = WOVO_PLAN_TERMS.map(
    (option) => option.effectiveMonthlyCents / 100 / option.monthlyCredits,
  );
  const currentPacks = 1 / 11;               // flat 11 credits per dollar, no volume bonus
  const legacyStudioPack = 25 / 300;         // still allowlisted so open Checkout Sessions can finish
  return Math.min(...subscriptions, currentPacks, legacyStudioPack);
}

test("the registry floor never assumes more revenue than a customer can actually pay", () => {
  const lowest = lowestRevenuePerCredit();
  assert.ok(
    AI_RETAIL_CREDIT_FLOOR_MICROS / 1_000_000 <= lowest + 1e-9,
    `floor $${AI_RETAIL_CREDIT_FLOOR_MICROS / 1_000_000}/credit exceeds the cheapest real rate $${lowest.toFixed(6)}/credit`,
  );
});

test("no enabled generation loses money at the cheapest credit a customer can buy", () => {
  const lowest = lowestRevenuePerCredit();
  const quotes = [
    quoteSocialPostImage(),
    quoteShortVideo(false),
    quoteShortVideo(true),
    quoteMusicTrack("economy", 30),
    quoteMusicTrack("economy", 180),
    quoteMusicTrack("premium", 180),
  ];
  for (const quote of quotes) {
    const costPerCredit = quote.estimatedProviderCostMicros / 1_000_000 / quote.customerCredits;
    const margin = (lowest - costPerCredit) / lowest;
    assert.ok(
      margin >= 0.8,
      `${quote.workflow} keeps only ${(margin * 100).toFixed(1)}% at $${lowest.toFixed(6)}/credit`,
    );
  }
});

test("credit packs carry no volume bonus that would undercut the floor", () => {
  // A bigger pack must never buy a cheaper credit than a small one.
  const rates = [10, 20, 50, 100, 500, 1000].map(
    (dollars) => dollars / creditPackUnitsForDollars(dollars),
  );
  const cheapest = Math.min(...rates);
  const dearest = Math.max(...rates);
  assert.ok(
    dearest - cheapest < 1e-9,
    `pack pricing is no longer flat (${cheapest.toFixed(6)}–${dearest.toFixed(6)}/credit) — re-check margin safety`,
  );
});
