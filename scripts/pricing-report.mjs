// Prints the WOVO plan economics table from the live pricing catalog and the
// contribution-margin simulator. Run: node scripts/pricing-report.mjs
import { WOVO_PLAN_CATALOG, getWovoPlanTerm } from "../lib/portal/pricing-catalog.ts";
import {
  maxMonthlyCreditsForMargin,
  planTermEconomics,
  WOVO_LAUNCH_COST_ASSUMPTIONS as A,
} from "../lib/portal/pricing-economics.ts";

const usd = (cents) => `$${(cents / 100).toFixed(2)}`;
const pct = (bps) => `${(bps / 100).toFixed(1)}%`;

console.log("Assumptions: provider %s/credit, Stripe %s%% + %s, storage %s/mo, support %s/mo, utilization %s%%",
  `$${(A.providerCostPerCreditMicros / 1e6).toFixed(5)}`, (A.stripePercent * 100).toFixed(1),
  usd(A.stripeFixedCents), usd(A.storageEgressCentsPerMonth), usd(A.supportCentsPerMonth), A.utilization * 100);
console.log("");

for (const plan of WOVO_PLAN_CATALOG) {
  console.log(`${plan.name}  —  ${usd(plan.monthlyPriceCents)}/mo list, ${plan.monthlyCredits} credits/mo today`);
  const rows = [];
  for (const term of ["monthly", "quarterly", "semiannual", "annual"]) {
    const opt = getWovoPlanTerm(plan.id, term);
    const e = planTermEconomics({
      monthlyCredits: opt.monthlyCredits,
      amountCents: opt.amountCents,
      monthsCovered: opt.monthsCovered,
    });
    rows.push({
      term: opt.label,
      effMonthly: usd(e.effectiveMonthlyRevenueCents),
      provider: usd(e.providerCostCentsPerMonth),
      stripe: usd(e.stripeFeeCentsPerMonth),
      contribution: usd(e.contributionCentsPerMonth),
      margin: pct(e.contributionMarginBps),
      safe70: maxMonthlyCreditsForMargin({ amountCents: opt.amountCents, monthsCovered: opt.monthsCovered }, 7000),
      safe60: maxMonthlyCreditsForMargin({ amountCents: opt.amountCents, monthsCovered: opt.monthsCovered }, 6000),
      safe50: maxMonthlyCreditsForMargin({ amountCents: opt.amountCents, monthsCovered: opt.monthsCovered }, 5000),
    });
  }
  console.table(rows);
  const worst = Math.min(...rows.map((r) => r.safe70));
  const worst60 = Math.min(...rows.map((r) => r.safe60));
  const worst50 = Math.min(...rows.map((r) => r.safe50));
  console.log(`  binding term = annual → safe max ${worst} credits @70%, ${worst60} @60%, ${worst50} @50%`);
  console.log("");
}
