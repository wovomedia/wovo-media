# AGENTS.md — WOVO Media

**Read `docs/AI_HANDOFF.md` first, before you read anything else in this repo.**
It records what is actually built, what is verified, what is broken, and what the
next ten pieces of work are. It is written to be true, not optimistic. If this
file and `docs/AI_HANDOFF.md` ever disagree, the handoff wins.

Then read the product specs — they are the source of truth for product intent:

- `docs/FEATURE_MATRIX.md` — what is actually built, with honest statuses. Read
  this before claiming WOVO can do anything.
- `docs/WOVO_MASTER_PRODUCT_DEFINITION.md`
- `docs/ADAM_FOLLOW_UP_SUGGESTIONS.md`
- `docs/BRAND_ASSETS.md`
- `docs/AD_SPEND_WALLET.md` — design only, blocked behind a legal/accounting gate
- `docs/MOBILE_APP_RELEASE.md` — not started; store rules move, re-check before use

---

## The rules

### 1. Continue this repository. Do not restart.

This is a live product with paying-capable infrastructure: Supabase auth and
Postgres, Stripe checkout and webhooks, a credit ledger, a server-side model
registry, and a deployed Vercel site at `wovomedia.com`. Scaffolding a new app,
regenerating the schema, or "starting clean" destroys working systems. Read the
existing code, extend it, and fix it in place.

Active branch: `wovo-v2`. Deployments come from that branch.

### 2. Do not recreate the legacy owner or customer workspaces.

The owner/admin panel was deleted on purpose, not hidden. The following files
were removed and must not come back:

- `app/portal/OwnerOperations.tsx`
- `app/portal/AdamOperations.tsx`
- `app/portal/OwnerPublishingCenter.tsx`
- `app/portal/OwnerMetaConnection.tsx`
- `app/portal/AiOperator.tsx`
- `app/portal/CartoonSeries.tsx`

The old agency-style "client marketing workspace" — brand-asset upload gates,
workspace-progress checklists, "unlock the working version" previews, per-client
support channels — is legacy. `/portal` still renders parts of it (see the
handoff's legacy-UI table for exactly which parts are REMOVED, STILL REACHABLE,
or UNKNOWN). The direction is to replace it with the product in the master
definition, not to restore it.

There is no owner tier, no `owner_exempt` flag, and no infinite-credit account.
`tests/ui-truthfulness.test.mts` guards this. If that test fails because you
reintroduced owner UI, fix the code — not the test.

### 3. Test before you claim PASS.

The user made this a hard rule and it is the single most important convention
in this repo.

- Only write **PASS** if you personally ran it and watched it succeed.
- Otherwise write **NOT TESTED**, **BLOCKED**, **PARTIALLY IMPLEMENTED**,
  **DISABLED**, or **NEEDS VERIFICATION**, and say what would settle it.
- Never report a deployment that did not happen.
- Do not trust `.env.production.local` or any other local snapshot to tell you
  what is enabled in production. It has been stale before and it caused a wrong
  report. Check the live site or the Vercel dashboard.

Local checks that should pass before you hand work back:

```
npm run lint
npx tsc --noEmit
npm run build
node --test tests/*.test.mts
```

### 4. Keep customer-facing providers hidden.

WOVO is provider-agnostic to the customer. Never let any of these reach a
customer's screen, a customer-visible error, a page's HTML, or a public API
response: fal.ai / fal, OpenAI, or any other upstream vendor name; provider
endpoints, model IDs, balances, or per-call costs; internal routing logic;
API keys; raw provider error text.

Route customer-facing errors through `lib/errors/customer-safe.ts`
(`customerSafeMessage` / `internalErrorCode`). It exists for this. Full detail
still goes to server logs — just not to the browser.

### 5. Keep the credit economics safe.

`lib/portal/pricing-economics.ts` holds the cost model; `scripts/pricing-report.mjs`
prints the plan table. Before changing plan allowances, credit prices, model
costs, or adding a promo or volume bonus, run the report and check margin at the
**lowest legitimate revenue per credit** — currently $0.08333 from the legacy
$25 / 300-credit pack, which is still allowlisted for open Checkout Sessions —
and assume **100% credit utilisation**. Today's worst case is an 81.3% margin.
Do not ship a change that pushes a plan under water. Raising allowances to the
levels discussed informally would need 2.5–3.5× the current headroom; that is a
business decision for the owner, not a code change to make quietly.

### 6. Never show a control that cannot complete.

Generation availability is computed at build time in `app/page.tsx` from the
presence of provider keys and the `WOVO_*_ENABLED` flags, and passed down as
`CreationAvailability`. If a capability is off, the tab is disabled and says so.
Do not render fake buttons, fake progress, fake credit meters, or example
projects that do not exist. Everything on screen must be true.

### 7. The funnel is fixed.

land → ask Adam → free account → verify → 10 free credits → create → download →
return → *optionally* pay.

Never put payment before the first real product experience. The free credits are
real, the output is downloadable, and there is no watermark-and-paywall step.

---

## Permission boundaries

**Ask the owner first:** destructive production database actions; deleting
substantial existing functionality when intent is unclear; force pushing;
resetting published git history; spending meaningful real money through
third-party APIs; deploying irreversible production changes; changing production
secrets; irreversible billing or business decisions.

**Do not ask; just do it:** file edits, component changes, bug fixes, local
migrations, tests, typechecks, builds, safe refactors, local dev commands,
browser QA, local database inspection.

---

## Repository facts you will need

- **The one canonical repository is `C:\Users\1xpay\wovo-media`.** Working tree
  and `.git` in one place, on branch `wovo-v2`. Everything — Claude, Codex, VS
  Code, the Desktop scripts — points here. There is no second checkout.
- Remote: `https://github.com/wovomedia/wovo-media.git`
- Retired on 2026-09-03, kept only as a safety net until `wovo-v2` is pushed:
  `OneDrive\Desktop\wovo-media` (the old repo) and
  `.codex\worktrees\a051\wovo-media` (the old worktree). Both carry a
  `README-RETIRED.md`. Do not edit files in either. `~/wovomedia` and
  `~/wovomedia-site` are unrelated scratch projects, also marked.
- The repo deliberately sits **outside OneDrive**. The old location was inside
  it, which caused CRLF churn, multi-minute git commands and files git could not
  unlink. Do not move it back under `OneDrive\`.
- Desktop scripts, all pointing at the canonical folder: `Deploy WOVO.bat`
  (production), `Back up WOVO to GitHub.bat`, `Run WOVO Locally.bat`,
  `Open WOVO Folder.bat`.
- Deployment is run by the owner from `Deploy WOVO.bat`. Agents have no Vercel
  credentials. If a change needs to ship, say plainly that one manual run of that
  script is required — do not claim it deployed.
- Documentation-only changes do not require a redeploy.
- `npm ci` takes about 20 seconds here and `npm test`, `npx tsc --noEmit` and
  `npm run lint` all run locally, so there is no excuse for shipping unverified.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vercel,
Supabase (hand-rolled REST client in `lib/supabase/`, not `supabase-js`), Stripe.

---

## Before you finish

Update `docs/AI_HANDOFF.md` with what you actually did, what you actually
verified, and what you left undone. The next agent — human or otherwise — starts
from that file. Leave it more useful than you found it.
