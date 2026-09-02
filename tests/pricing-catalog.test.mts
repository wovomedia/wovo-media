import assert from "node:assert/strict";
import test from "node:test";

import { creditPackUnitsForDollars, WOVO_PLAN_TERMS } from "../lib/portal/pricing-catalog.ts";

const REVENUE_FLOOR_DOLLARS_PER_CREDIT = 0.083333;
const WORST_ENABLED_PROVIDER_COST_DOLLARS_PER_CREDIT = 0.015257;

test("all twelve WOVO subscription combinations clear the audited revenue floor", () => {
  assert.equal(WOVO_PLAN_TERMS.length, 12);
  for (const option of WOVO_PLAN_TERMS) {
    const monthlyRevenue = option.effectiveMonthlyCents / 100;
    const revenuePerCredit = monthlyRevenue / option.monthlyCredits;
    assert.ok(revenuePerCredit >= REVENUE_FLOOR_DOLLARS_PER_CREDIT, `${option.planId}/${option.frequency} fell below the revenue floor`);
    const directMargin = 1 - WORST_ENABLED_PROVIDER_COST_DOLLARS_PER_CREDIT / revenuePerCredit;
    assert.ok(directMargin >= 0.8, `${option.planId}/${option.frequency} fell below 80% direct margin`);
    assert.match(option.priceId, /^price_/);
  }
});

test("pay-as-you-go credits are calculated only from whole-dollar server amounts", () => {
  assert.equal(creditPackUnitsForDollars(10), 110);
  assert.equal(creditPackUnitsForDollars(75), 825);
  assert.equal(creditPackUnitsForDollars(1000), 11000);
  assert.equal(creditPackUnitsForDollars(1), 110);
  assert.equal(creditPackUnitsForDollars(50000), 110000);
});
