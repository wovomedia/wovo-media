import assert from "node:assert/strict";
import test from "node:test";

import { quoteMusicTrack, quoteShortVideo, quoteSocialPostImage } from "../lib/ai/provider-models.ts";
import { WOVO_PLAN_TERMS } from "../lib/portal/pricing-catalog.ts";
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
