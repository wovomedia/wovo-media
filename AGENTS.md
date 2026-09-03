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

- **There is no single folder that is both the history and the deploy source.**
  Two locations, each with one job:
  - **Commit history:** `C:\Users\1xpay\OneDrive\Desktop\wovo-media\.git`,
    branch `wovo-v2`. This is where commits live. Its working tree is checked
    out on `main` and is stale — ignore the files, use the `.git`.
  - **Deploy source:** `C:\Users\1xpay\.codex\worktrees\a051\wovo-media`.
    Files only, outside OneDrive, with `node_modules` and the Vercel link.
    `Deploy WOVO.bat` deploys from here.
- **`C:\Users\1xpay\wovo-media` IS A DIFFERENT, OLDER PROJECT** — the pre-rebrand
  Nova site. It is not WOVO V2. Deploying it on 2026-09-03 replaced the live
  site with the Nova page for five minutes. Never `cd` there, never deploy it.
- The deploy folder's `.git` is deliberately broken (its worktree registration
  was pruned). Keep it that way: with no usable git, the Vercel CLI cannot start
  a git-integration build and must upload the actual files.
- Remote: `https://github.com/wovomedia/wovo-media.git`. GitHub's `main` is the
  old product and `wovo-v2` has never been pushed. Never let Vercel deploy from
  git until that is fixed.
- Desktop scripts: `Deploy WOVO.bat` (deploys a051), `ROLLBACK WOVO.bat`
  (restores the last good build in under a second), `Open WOVO Folder.bat`,
  `Run WOVO Locally.bat`.
- Deployment is a manual double-click by the owner; agents have no Vercel
  credentials. **A green "Ready" line from the CLI does not prove the right code
  shipped — always load wovomedia.com and check.**
- `npm ci`, `npx tsc --noEmit`, `npm run lint` and `npm test` all run locally.


Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vercel,
Supabase (hand-rolled REST client in `lib/supabase/`, not `supabase-js`), Stripe.

---

## Before you finish

Update `docs/AI_HANDOFF.md` with what you actually did, what you actually
verified, and what you left undone. The next agent — human or otherwise — starts
from that file. Leave it more useful than you found it.
