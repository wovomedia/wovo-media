# WOVO — AI handoff

**Read this before touching anything.** For Codex, ChatGPT, Claude Code, VS Code,
and any future agent.

Last updated: **2026-09-03** by Claude (Cowork session).
Status labels are literal: `PASS` means it was actually run and observed.
Anything not tested says so.

---

## 1. Repository

| | |
|---|---|
| **Canonical repository** | `C:\Users\1xpay\wovo-media` — working tree and `.git` together, one place, outside OneDrive |
| Branch | `wovo-v2` |
| HEAD | `1799fe5d05ef944bb5e90b95864b0f21eeabbde9` |
| Uncommitted tracked files | **0** (clean) |
| Remote | `https://github.com/wovomedia/wovo-media.git` |
| Ahead of `origin/main` | **55 commits — NOT PUSHED** |
| Deployment script | Desktop → `Deploy WOVO.bat` |
| Backup script | Desktop → `Back up WOVO to GitHub.bat` |
| Run locally | Desktop → `Run WOVO Locally.bat` (`npm ci` ~20s; tsc, eslint and 70 tests all run locally) |
| Open the folder | Desktop → `Open WOVO Folder.bat` |
| Retired, do not edit | `OneDrive\Desktop\wovo-media` and `.codex\worktrees\a051\wovo-media`, both carrying `README-RETIRED.md`. Kept only until `wovo-v2` is pushed to GitHub. |
| Deployment source dir | the canonical repository above |
| Production URL | https://wovomedia.com |
| Vercel project | `wovo-media` · `prj_8EOBWflTMlmfhkVNcCIeBWcFtuis` · team `team_Quckvj8AA5WNLgwXOk56cHX2` |
| Supabase | `WovoMedia` · ref `dadbukxeayosvkqcrzfm` |
| Stripe | live account `acct_1SekXmFmIvQosWF9` |

**GitHub is 55 commits behind and does not contain V2.** Never trigger a
git-based Vercel deploy — it would build `origin/main` and ship the old
Nova/employee product over the live site. Deploys are Vercel CLI pushes from the
canonical repository.

---

## 2. Deployment history

The owner **manually ran `Deploy WOVO.bat`** on 2026-09-02.

| | |
|---|---|
| Deployment | `dpl_cfo45XdLCxewg9m9s366T5p4eN9L` |
| State | `READY`, target `production` |
| Commit deployed | `b78355e` (`gitCommitRef: wovo-v2`, `gitDirty: 1`) |
| Production matches local HEAD | **NO** — production is behind by the 2026-09-03 commits |
| Another deploy required? | **YES — production is stale.** Live is `b78355e`. The legacy-workspace removal of 2026-09-03 is committed locally but **not deployed**. Until `Deploy WOVO.bat` is run, signed-in customers still see the old agency dashboard. |

`gitDirty: 1` reflects untracked/ignored files present at deploy time (e.g. the
backup bundle), not uncommitted source.

### READ THIS BEFORE YOU DEPLOY — `vercel --prod` is not safe here

**On 2026-09-03 a `vercel --prod` run replaced wovomedia.com with the old Nova
site for about five minutes.** It was rolled back. Here is exactly why, so it
does not happen again.

The Vercel project `wovo-media` is **linked to GitHub `wovomedia/wovo-media`**
(confirmed via the Vercel API: `link.type = "github"`). When the CLI runs inside
a directory whose git remote matches that link, it does **not** upload your local
files. It asks Vercel to build a commit from the connected repository instead.
That deployment came back tagged `githubDeployment: 1`, `githubCommitRef: main`,
`githubCommitSha: 9cfbe34` — an old commit from before the V2 rebrand — while the
local working tree was 60 commits further along on `wovo-v2`.

The earlier CLI deploys from the `.codex` worktree were tagged `gitDirty: 1` with
a plain `gitCommitSha`, i.e. real file uploads. The worktree's indirect `.git`
file evidently stopped the CLI resolving the link. The consolidated repository
has a normal `.git`, so the link now resolves and the behaviour changed.

**Until GitHub carries `wovo-v2` and Vercel's production branch points at it, a
plain `vercel --prod` will ship the wrong code.** Verify the live site after any
deploy — the CLI prints "Ready" and aliases the domain either way, so a green CLI
run proves nothing.

Rolling back: `Desktop\ROLLBACK WOVO.bat` promotes
`wovo-media-hk6aiqkib-...vercel.app` (`dpl_cfo45XdLCxewg9m9s366T5p4eN9L`,
commit `b78355e`), the last known-good V2 production build. It takes under a
second. Keep that script until deploys are trustworthy.

### Deploying is a manual step — BLOCKED for agents, by tooling

An agent in this environment **cannot deploy**. All of the following were tested
and confirmed closed:

- Vercel CLI: not installed in the device shell
- Vercel credentials: not present in the device shell (they live in Windows)
- `api.vercel.com` from the device shell: **no route** (egress blocked, curl 000)
- Computer control: terminals are granted **click-only**; typing into a shell is blocked by design
- `deploy_to_vercel` MCP: requires the file tree inline; `public/` alone is 8.4 MB

**The one manual action: double-click `Deploy WOVO.bat`.** Do not claim a deploy
happened without checking Vercel.

---

## 3. Legacy product removal

### Removed — DO NOT RECREATE

Deleted in `b0cf99d`, with `tests/ui-truthfulness.test.mts` failing if any file
returns:

- `app/portal/OwnerOperations.tsx` (Owner Command Center / WOVO Operations)
- `app/portal/AdamOperations.tsx` (Adam Operations)
- `app/portal/OwnerPublishingCenter.tsx`
- `app/portal/OwnerMetaConnection.tsx`
- `app/portal/AiOperator.tsx`
- `app/portal/CartoonSeries.tsx`
- Owner exemption UI: the `∞` credit panel and "Unlimited internal creation"
- `owner_exempt` branch in portal notices
- The unpaid-workspace paywall screen and `UnpaidWorkspacePreview`

Also redirected: `/workspace` → `/`, `/wovo-ai/creator/[username]` → `/portal`.

The founder now uses the same `/portal` as customers. **Server-side entitlements
were not changed** — this was a visibility fix.

### REMOVED on 2026-09-03 — the legacy workspace is gone

Every item below was on screen for a signed-in customer on 2026-09-02 and was
deleted from the source on 2026-09-03. Each is pinned by a test in
`tests/ui-truthfulness.test.mts` or `tests/creator-navigation.test.mts`, so a
future agent cannot quietly reintroduce it.

| Legacy element | Status |
|---|---|
| "Client marketing workspace" header | **REMOVED** |
| "WOVO creation tools" heading and its product tiles | **REMOVED** |
| "Upload required brand assets." | **REMOVED** |
| "Workspace progress 1/4" meter | **REMOVED** |
| "Message WOVO — Open your private shared support channel" | **REMOVED** (the whole Inbox tab is gone) |
| "Your preview is ready. Unlock the working version." | **REMOVED** |
| "assigned WOVO representative" | **REMOVED** |
| "WOVO Media client portal" footer | **REMOVED** |
| Old cream/black dashboard styling | **REMOVED** — the content surface is dark |
| Staff workspace: client switcher, public-inquiry replies, "President / owner" badge | **REMOVED** |
| "Owner-protected settings / cross-client controls" in Settings | **REMOVED** |
| Plan / add-on / employee-invite onboarding wizard | **REMOVED** — replaced by one short screen |

`app/portal/page.tsx` went from **6,390 to 4,908 lines**. Checked against the
build output: none of these strings appear in `.next/` any more.

### STILL PRESENT — server side only, no UI reaches it

| Remnant | Why it is still there |
|---|---|
| `mode: "staff"` in `lib/portal/server.ts` and ~15 authorization checks in `app/api/portal/route.ts` | It gates authorization, not UI. Ripping it out is a separate, riskier refactor. No customer-facing surface reads it any more. |
| `/api/portal/adam`, `/api/portal/operator`, owner-gated branches of `/api/portal/publishing` | Dead endpoints from the deleted owner panel. They deny every non-owner caller, no UI calls them, and their 403 text no longer leaks internal role names. |

Deleting those routes is a good next task; it was left undone rather than done
carelessly.

### NEEDS VERIFICATION — the new onboarding

The rebuilt onboarding screen is the **only** path that creates a workspace and
releases the ten one-time starter credits. It compiles, typechecks and is covered
by string-level tests, but **no human has completed it since the rewrite**. A real
signup is the first thing to check after the next deploy.

### Companion documents added 2026-09-03

- `docs/FEATURE_MATRIX.md` — every feature with an honest status. Read it before
  telling anyone what WOVO can do.
- `docs/AD_SPEND_WALLET.md` — wallet design and the legal/accounting gate that
  blocks it. Not a feature flag; a company-risk decision.
- `docs/MOBILE_APP_RELEASE.md` — what shipping the apps actually requires, with
  the app-store billing rules as they stood on 2026-09-03.

This is the single largest gap between the shipped product and
`docs/WOVO_MASTER_PRODUCT_DEFINITION.md`, and it is priority 1.

---

## 4. Auth

All browser-tested against **production on the deployed build** (2026-09-02):

| Flow | Status | How |
|---|---|---|
| Sign in | **PASS** | real browser, real account |
| Refresh keeps you signed in | **PASS** | hard navigation to `/portal` |
| Sign out | **PASS** | returns to `/login` |
| Stays signed out | **PASS** | navigating back to `/portal` returns to login |
| Signup (account created) | **PASS** | pre-deploy, real signup |
| Email verification | **PASS** | pre-deploy, real email, link consumed, `email_confirmed_at` set |
| 10 starter credits | **PASS** | pre-deploy, verified in ledger: `accounts=1, signup_grants=1, credit_balance=10` |
| Post-login redirect | **PASS** | lands in `/portal` |
| Password reset | **NOT TESTED** |
| Google auth | **NOT ENABLED** — component exists, unused. No dead button is shown. Correct for now. |
| Prompt/task preservation through auth | **CODE-ONLY** — `localStorage` intent → `/portal?resume=1` → `initialPrompt`. Not browser-tested end to end. |

### The signup bug that was fixed

Migration `20260830164549_wovo_user_signup_credit_grant.sql` was written Aug 30
and **never applied to production**. Deployed code called
`wovo_grant_signup_credits()` on every signup; the function did not exist; the
call threw; and the `catch` block **deleted the workspace it had just created**.
Every new signup was destroyed on creation. Migration applied 2026-09-02 and
verified. Zero signups had occurred since Aug 30, so no real users were lost.

**Lesson: applying a migration is a separate step from deploying. A green build
proves nothing about the database.**

---

## 5. Session resilience fix

**Previous behaviour:** `getActiveSession()` called `clearSession()` on *any*
refresh error. A dropped connection, a laptop waking from sleep, a rate limit, a
Supabase 5xx, or simply a second open tab signed the person out. Supabase refresh
tokens are single use, so two tabs refreshing concurrently guarantees one is
rejected — and that rejection was destroying the session.

**Changed:**
- `supabaseFetch` throws `SupabaseRequestError` carrying the HTTP status; network
  failures get status `null` instead of an indistinguishable `Error`.
- Only a 4xx refusal from the auth server clears the session
  (`lib/supabase/session-recovery.ts` → `isDefinitiveAuthFailure`).
- A refresh that loses the race to another tab re-reads storage and adopts the
  token that tab already wrote.
- Transient failure keeps the stored session and keeps using the current token if
  it has not hard-expired.

Committed `91b86e9`. **Deployed** in `b78355e`. Covered by
`tests/session-persistence.test.mts`. Production behaviour verified for the happy
paths above; the transient-failure path is **unit-tested only**, not reproduced
against production.

---

## 6. Provider error sanitization

Raw provider text was reaching customers from three legacy routes:

- `app/api/wovo/image/route.ts`
- `app/api/wovo/caption-image/route.ts`
- `app/api/wovo/chat/route.ts`

They returned `error.message` verbatim, so an OpenAI failure would have shown a
customer `Incorrect API key provided: sk-...` with a platform.openai.com link.

**Fixed** in `b78355e` with `lib/errors/customer-safe.ts`:
- `customerSafeMessage(error, fallback)` — replaces the whole message when it
  names internal infrastructure, contains a URL, a credential, or a stack frame,
  or exceeds 160 chars. A curated product message still passes through.
- `internalErrorCode(error, fallback)` — short screaming-snake code for logs.

Server logs get the code; the customer gets curated copy. Covered by
`tests/customer-safe-errors.test.mts`. **Deployed. Not reproduced live** (would
require forcing a provider failure).

The newer portal routes (`generate-post`, `music`, `video`) were already safe.

**Never expose:** API keys, provider URLs, provider identities, stack traces, raw
backend errors. Model names (FLUX 2, Wan 2.2 Turbo) are customer-facing and fine;
infrastructure providers are not.

---

## 7. Health endpoint

**Bug:** `/api/health/portal` required exactly **4** validated Stripe prices and
was never updated when the catalog became 3 plans × 4 terms = **12**. It could
never pass. Worse, one `try/catch` wrapped both the database probe and price
validation, so a billing mismatch was reported as `database: "unavailable"`.
Production returned **503** while the database was completely healthy.

**Fixed** in `b0cf99d`: each subsystem measured independently, expected count
derived from `WOVO_PLAN_TERMS.length`, and the payload carries
`validatedPrices` / `expectedPrices`.

**Verified live on production 2026-09-02:**

```json
{"ok":true,"database":"ready","billing":"ready",
 "validatedPrices":12,"expectedPrices":12,
 "billingPeriods":["monthly","quarterly","semiannual","annual"]}
```

This also proves **all 12 Stripe subscription prices are correctly configured**
(active, livemode, correct amount/interval, and `monthly_credits` metadata
matching the catalog). Stripe config health: **PASS**.

---

## 8. Pricing and credit economics

Simulator: `lib/portal/pricing-economics.ts`. Report: `node scripts/pricing-report.mjs`.
Guards: `tests/pricing-economics.test.mts`.

**Rule: assume 100% credit utilisation. Never count unspent credits as margin.**

### Lowest legitimate revenue per credit

| Source | $/credit |
|---|---|
| Legacy `studio` pack — **$25 / 300 credits** | **$0.08333 ← LOWEST** |
| Starter annual subscription ($11.99/mo ÷ 140) | $0.08566 |
| Current packs (flat 11 credits/$1, all tiers) | $0.09091 |

The **legacy $25/300 pack determines the floor.** It is still allowlisted in
`lib/portal/credit-packs.ts` (marked `legacy: true`) so already-open Checkout
Sessions can finish idempotently. It is **not** shown in the V2 purchase UI.

There are **no promotion codes or coupons** enabled on checkout, and **no volume
bonus** — a $1,000 pack buys the same rate as a $10 pack. Both verified.

### Worst-case enabled generation

| Workflow | Credits | Provider cost | $/credit | Margin at $0.08333 |
|---|---|---|---|---|
| **Image (worst)** | 2 | $0.03114 | $0.01557 | **81.3%** |
| Music premium | 13 | $0.20 | $0.01538 | 81.5% |
| Music economy (3 min) | 6 | $0.06 | $0.01000 | 88.0% |
| Video 720p | 12 | $0.10 | $0.00833 | 90.0% |

**Result: SAFE.** Three guards enforce it — the registry floor may never assume
more revenue than the cheapest real rate; every enabled quote must keep 80%
against that rate; packs must stay flat.

### Plan allowances

Current: Starter **140**, Creator **225**, Pro **420** credits/month.
Contribution margin at full burn (provider + Stripe + storage + support):
**74.9%–80.9%**. Binding case is always the **annual** term.

| Plan | Now | Safe @70% | @60% | @50% | Owner target |
|---|---|---|---|---|---|
| Starter $14.99 | 140 | 177 | 254 | 331 | 400–600 |
| Creator $24.99 | 225 | 316 | 445 | 573 | 1,200–1,500 |
| Pro $44.99 | 420 | 595 | 826 | 1,057 | 2,500–3,500 |

The owner's target allowances need **2.5–3.5× more than is safe even at 50%
margin**. Starter at 500 credits annual works out to ~28% contribution margin.
They are not silently shrunk — they were never raised, and this is why.

**A credit is an arbitrary unit.** An image costs 2 credits; if it cost 8,
Starter would be 560 credits with identical economics. The target headline
numbers are reachable by rescaling the unit — but the "10 free credits" promise
would have to scale to 40, or a free account gets one image instead of five.

### Do not change allowances without Stripe

`getValidatedPortalBillingOption()` rejects any price whose Stripe
`monthly_credits` metadata disagrees with `WOVO_PLAN_CATALOG`. **Editing the
catalog alone makes every plan fail validation and kills checkout.** Changing
allowances means writing new metadata to all 12 live prices *and* changing the
catalog together.

### Legacy pack decision needed

A future agent should decide whether the `$25/300` legacy pack should **remain**,
**be migrated**, or **stop being sold**. It currently sets the margin floor.
**Do not silently remove existing purchased entitlements** — customers hold
credits bought at that rate.

---

## 9. Generation / model status

**Correction to an earlier report:** the local `.env.production.local` snapshot
showed video/cartoon flags as empty strings and music absent. **That snapshot was
stale.** Verified live 2026-09-02: video and audio are **enabled** in real
production. Always check the Vercel dashboard, never the local snapshot.

| | Code | Production | Provider verified | Real generation tested | Storage verified | Metering verified | Refund verified | Customer UI | Next action |
|---|---|---|---|---|---|---|---|---|---|
| **Image** | enabled | enabled | NOT TESTED | **NOT TESTED** | NOT TESTED | code-only | code-only | visible, 2 credits | Run one real image canary end to end |
| **Video** | enabled | **enabled** (verified live, 12 credits, 720p only) | NOT TESTED | **NOT TESTED** | NOT TESTED | code-only | code-only | visible | Canary + confirm refund on failure |
| **Music** | enabled | **enabled** (verified live, 2 credits, instrumental only) | NOT TESTED | **NOT TESTED** | NOT TESTED | code-only | code-only | visible | Instrumental only — full songs/lyrics/singer NOT built |
| **Cartoon** | enabled | UNKNOWN (tab present; flag not independently confirmed) | NOT TESTED | **NOT TESTED** | NOT TESTED | code-only | code-only | visible | Confirm flag + provider before trusting |
| **Voice profiles** | NOT IMPLEMENTED | — | — | — | — | — | — | none | Roadmap; needs explicit consent capture |
| **Likeness profiles** | NOT IMPLEMENTED | — | — | — | — | — | — | none | Roadmap; needs explicit consent capture |
| **Brand assets** | NOT IMPLEMENTED | — | — | — | — | — | — | none | Spec at `docs/BRAND_ASSETS.md` |

**No real generation was run in this session.** Nothing above may be called
working until a canary produces a real asset, stores it, meters credits, and
refunds correctly on failure.

`1080p` and `4K` are correctly shown as unavailable — WOVO does not sell what it
cannot deliver.

### Caveat on the availability gate

`app/page.tsx` reads the feature flags via `process.env` in a **server component
on a statically rendered page**, so availability is baked in at **build time**.
Changing a flag in Vercel without redeploying will desynchronise the UI from the
server route. **Redeploy after any flag change.**

---

## 10. Feature flags (state only, no values)

| Flag | State |
|---|---|
| `WOVO_VIDEO_GENERATION_ENABLED` | **enabled** in production (verified via live UI) |
| `WOVO_MUSIC_GENERATION_ENABLED` | **enabled** in production (verified via live UI) |
| `WOVO_CARTOON_VIDEO_ENABLED` | UNKNOWN — tab renders, flag not independently confirmed |
| `WOVO_META_PUBLISHING_ENABLED` | UNKNOWN |
| `WOVO_IMAGE_GENERATION_ENABLED` | not referenced by the main image path (`generate-post`); only by the operator route |
| `WOVO_AI_OPERATOR_CHECKOUT_ENABLED` | UNKNOWN |
| `WOVO_CARTOON_SERIES_CHECKOUT_ENABLED` | UNKNOWN |

Confirm all of these in the Vercel dashboard. The local env file is not
authoritative.

---

## 11. Stripe / payments

| | Status |
|---|---|
| 12 subscription prices configured and validating | **PASS** (health endpoint, live) |
| Credit-pack checkout | **NOT TESTED** |
| Subscription checkout | **NOT TESTED** |
| Webhook processing | **NOT TESTED** |
| Credit grant on purchase | **NOT TESTED** |
| Duplicate-webhook idempotency | code exists (event table); **NOT TESTED** |
| Refund on failed generation | reserve/finalize/release RPCs exist; **NOT TESTED** live |
| Next subscription credit grant | **NOT TESTED** |
| 3-month / 6-month / annual terms | validated by health endpoint; purchase **NOT TESTED** |

**No real money was spent in this session.** Webhooks are the authoritative
grant path — never trust the browser success redirect.

---

## 12. UI work completed (all deployed)

- **Free-first access** (`0b8a92d`) — `assertPaid` removed from 8 core product
  actions; kept on `sendMessage` / `createEvent` / `createOrder`, which buy human
  WOVO labour. Asset-upload subscription check removed. Paywall screen deleted.
- **Universal Adam composer** (`c49ab4c`) — `app/WovoCreateExperience.tsx`.
  Adam is the default tab, not Image. `routeAdamPrompt()` in
  `lib/ai/public-model-catalog.ts` routes create / find / assist deterministically
  in the browser; retrieval and planning show "no credits used". Removed the
  duplicated seven-column settings strip and the fake hardcoded starter-credit
  meter. Headline is now "What do you want WOVO to handle?".
- **Pricing** (`01f7fac`) — `app/pricing/PricingExperience.tsx`. Real accessible
  range sliders replace a three-button toggle that displayed **invented** credit
  costs (4 and 8 credits per image; WOVO charges 2). Cost explorer and plan
  estimator now read the same catalog the composer quotes from.
- **Auth redesign** (`91b86e9`) — `components/auth/auth-frame.tsx`. Single dark
  centred card. Deleted a fabricated "This week / 3 projects" panel listing work
  that never existed. Mobbin references studied for structure (Vapi, Tines,
  Leonardo AI, OpenAI Platform); implementation is WOVO's own.
- **Tool availability gating** (`b0cf99d`) — the composer no longer advertises a
  creation type with a credit price when its provider keys or feature flag are off.
- **Copy corrections** — "Weekly Marketing Workspace" titles, "paid workspace
  access begins only after Stripe confirms", "From $15", "Sign in to your
  workspace".

---

## 13. UI still needing work

1. **`/portal` is the legacy client dashboard** — see section 3. Highest priority.
2. Old cream marketing pages behind the old `SiteHeader`/`SiteFooter`: `/about`,
   `/product`, `/workflow`, `/services`, `/results`, `/case-studies`, `/contact`,
   `/cartoon-episodes`, legal pages. (`/` and `/pricing` already exclude that chrome.)
3. Sidebar nav links on `/` (Calendar, Assets, Projects, Inbox, Connections,
   Settings) all point at `/login?next=/portal`. `/portal` has tabs but no
   `?tab=` deep-link support.
4. `Website Builder` and `Cartoon Studio` tiles — suspected dead buttons.
5. Music is instrumental-only; the spec requires full songs with lyrics and an AI singer.
6. Mobile: **NOT TESTED** at phone viewport.
7. Full public route crawl: **NOT DONE**.
8. Test data left in production: account `support+wovoqa03@wovomedia.com`
   ("Wovo QA Diner"). Its brand-voice field contains garbled text from automated
   test typing — that is test-data corruption, not a product bug. Delete when done.

---

## 14. Product source of truth

Read **before** any major architecture or product change:

- `docs/WOVO_MASTER_PRODUCT_DEFINITION.md` — what WOVO is, the products, navigation, credits, auth, design rules, and the list of surfaces that must never return
- `docs/ADAM_FOLLOW_UP_SUGGESTIONS.md` — 2–4 contextual next-action chips under Adam responses
- `docs/BRAND_ASSETS.md` — logos, PFPs, covers, banners, social kits, brand kits
- `docs/WOVO_V2_REBUILD.md` — the 2026-08-30 architecture audit (still accurate; some "pending deployment" lines were stale for a month, including the one that took signup down)

**Read the product definition before reading old code.** Reading old code first
is exactly how the operations panel kept coming back.

---

## 15. Permanent product rules

**DO NOT RECREATE, under any name:**

Owner Command Center · WOVO Operations · Owner Dashboard · Owner Operator Panel ·
President/Owner workspace · Owner Access · OWNER EXEMPT UI · `∞` credits UI ·
Adam Operations · employee/staff WOVO product · employee dashboard · staff portal ·
staff workspace · Settings/Staff · Team Inbox operator system · Clients/Workspaces
operator system · Bookings & Services operator system · legacy private workspace ·
legacy "Wovo QA Diner"-style client dashboard · the old creation-tools sidebar ·
a separate founder application.

**ONE customer-facing WOVO application. The founder uses the same normal app.**

Other standing rules: no fake buttons · no fake progress · no credit quote for an
unavailable feature · no raw provider errors in customer UI · internal providers
never customer-facing · assume 100% credit utilisation · never sell credits below
safe generation cost · always show cost before expensive execution · failed
technical generations must not keep customer credits · mobile is first-class ·
**do not call something working without testing it**.

---

## 16. Product direction

WOVO is becoming an **AI marketing + business workspace**, not an image
generator: Adam (main interface) · Manual Create (power users) · WOVO Computer
(large outcomes) · Assets · Projects · Brand Brain · Brand Guardian · Calendar ·
Social · Connections · Email · Outreach · Guided Business Tasks · AI Music ·
Voice/Likeness Profiles · Cartoons/Characters · Brand Assets · API · Agency.

**Universal Adam:** the main input is not image-only. It handles chat, create,
search, research, business tasks, workspace retrieval, connected apps and
Computer tasks. Default is **Adam / Auto**, not Image. (Shipped.)

**Command system (planned):** `/image /video /ad /social /music /brand /logo /pfp
/banner /project /search /research /outreach /email /calendar /sheet /week /month
/computer`, plus `$` connector mentions: `$gmail $sheets $calendar $drive $docs
$contacts`. Commands are optional; natural language always works.

**Connectors (planned):** Google Workspace first — Gmail, Sheets, Drive, Docs,
Calendar, Contacts. Official OAuth only, progressive permissions, **draft-first**
email, never silent send or delete.

**Outreach (planned):** lead research · qualification · personalised drafts ·
review/send · follow-up · CRM-lite · send limits · opt-out handling. Not a spam
cannon; never fabricate contact information.

**Brand Assets (planned):** logo, PFP, Facebook cover, YouTube banner, X header,
LinkedIn banner, social kit, full brand kit. All outputs become Assets. Two rules
shape the architecture: **render critical text deterministically** (image models
mangle business names and URLs), and **never stretch one image** into another
platform's format — adapt with crop/recomposition/outpainting and safe areas.

**Smart follow-up suggestions (planned):** 2–4 contextual clickable next actions
under Adam responses. Never a dead chip; if a capability is unconfigured, offer
"Connect Instagram", not "Publish to Instagram now".

**AI Music (planned):** full songs with original lyrics and an AI singer — beat,
instrumentation, structure, manual or Adam-written lyrics, jingles, theme songs.
**Currently instrumental only. Do not reduce Music to background audio.**

**Voice / Likeness (planned):** authorized Voice Profiles, Likeness/Face
Profiles, People & Character library, consistent cartoons. **Feature-specific
explicit authorization is required — general Terms acceptance is not enough.**
Profiles must be deletable. Never leak one workspace's data to another. Do not
design around unauthorized celebrity cloning.

**Terms/consent:** signup stores Terms + Privacy version and timestamp; disclose
that authorized uploaded media may be processed by WOVO and approved
subprocessors; **never claim WOVO owns anyone's face or voice**. Final legal
wording needs professional review.

**Mobbin** is available for UI research (auth, composer, pricing, model picker,
connections, brand assets, Computer, mobile). Adapt patterns; never clone.

---

## 17. Next 10 priorities

Ranked on what is actually true as of 2026-09-03, after the legacy workspace
removal. The first three are all blocked on the same thing: a deploy.

1. **Deploy.** Production is `b78355e`; everything from 2026-09-03 is committed
   locally and not live. Until `Deploy WOVO.bat` runs, signed-in customers still
   get the old agency dashboard.
2. **Complete a real signup on production.** The rebuilt onboarding is the only
   path that creates a workspace and releases the 10 starter credits, and no
   human has run it since the rewrite. Check: workspace created, exactly 10
   credits, granted once, and a second attempt grants nothing.
3. **Run a real image canary** end to end — generate, asset stored, credits
   metered, file downloads. The core promise is still unproven.
4. **Verify the credit refund path** by forcing a provider failure and confirming
   reserved credits come back.
5. **Push `wovo-v2` to GitHub.** 58 commits exist on one machine. Until that
   happens the retired folders cannot be deleted, because they are the only
   other copy.
6. **Implement free-tier social connection limits** — 2 per platform per
   workspace, server-enforced, with an `extended_social_connections`
   entitlement. Currently there is no cap anywhere in the code.
7. **Test a real Stripe credit purchase** ($10) and one subscription: checkout →
   webhook → ledger → balance → duplicate-webhook protection.
8. **Delete the dead owner-only API routes** — `/api/portal/adam`,
   `/api/portal/operator` and the owner branches of `/api/portal/publishing`.
   No UI calls them; they only deny.
9. **Mobile pass** at phone viewport across root, auth, pricing and the
   workspace, now that the workspace shell has changed.
10. **Then the roadmap**, in the owner's own order: Adam follow-up suggestions →
    Adam over Projects and Assets → Brand Assets → Cartoon character
    references, voices and episode memory → WOVO Computer → Revenue Engine →
    direct-platform-billing ads. `docs/FEATURE_MATRIX.md` says where each one
    actually stands; `docs/AD_SPEND_WALLET.md` says why the wallet waits.

---

## 18. Session summary — 2026-09-02

**What I changed**
- Applied the missing signup-credit migration to production
- Removed the subscription paywall from 8 core product actions and asset upload
- Deleted the entire owner operations product (6 components) plus its UI hooks
- Made Adam the default composer surface with deterministic intent routing
- Rebuilt the auth screens; removed a fabricated project panel
- Replaced a fake pricing "slider" that displayed credit costs WOVO never charges
- Added a contribution-margin simulator, a pricing report script, and margin guards
- Fixed session persistence so transient failures no longer sign people out
- Fixed the health endpoint (4-vs-12 prices; coupled subsystems)
- Sanitised provider errors on three legacy routes
- Gated the composer so no disabled tool is advertised with a price
- Recorded three owner product specs into `docs/`

**What I verified** — production, real browser, after deploy: sign in, refresh
persistence, sign out, stays signed out, health endpoint (`ok:true`, 12/12
prices), Adam-default composer, video tab (12 credits, 720p only), audio tab
(2 credits). Pre-deploy: real signup, real email verification, 10 credits in the
ledger. Every commit: tsc clean, eslint 0 errors, 66/66 tests, production build.

**What I committed** — 10 commits from `0b8a92d` to `b78355e` on `wovo-v2`.

**What I deployed** — nothing directly; the owner ran `Deploy WOVO.bat`.
Production is `b78355e`.

**What is still broken** — the legacy `/portal` dashboard; old cream marketing
pages; nav links that cannot deep-link; music limited to instrumental; suspected
dead Website Builder / Cartoon Studio tiles.

**What I intentionally did NOT test** — any real generation (provider spend),
any real Stripe purchase (real money), password reset, mobile viewports. I also
did not change model selection or provider routing, because verifying model
availability requires paid canaries and the owner had not approved that spend.

**What the next agent should do first** — read
`docs/WOVO_MASTER_PRODUCT_DEFINITION.md`, then start on priority 1: replacing the
legacy `/portal` dashboard.

---

## 19. Session summary — 2026-09-03

**Repository consolidated.** One canonical folder at `C:\Users\1xpay\wovo-media`,
outside OneDrive, holding both the working tree and `.git`. It was cloned from the
old split layout with full history, verified to have the identical HEAD, both
branches and a clean tree, then given the Vercel link and env file. Four Desktop
scripts point at it. The two old locations carry `README-RETIRED.md`. Git commands
that used to take three minutes now return instantly, and `npm ci` takes 20
seconds, which is what made the rest of this session's verification possible.

**The legacy signed-in product is gone.** `app/portal/page.tsx` went from 6,390 to
4,908 lines. Removed: the agency dashboard chrome, the staff/owner workspace, the
plan-first onboarding wizard, the support-channel Inbox, and the cream styling.
Kept and rebuilt: the workspace creation path that grants the 10 starter credits.
Every removal is pinned by a test.

**Other fixes.** Pricing badge collision on the Creator card (two badges, one
absolutely positioned, sitting on top of each other) and a missing two-column
breakpoint. Credit balance surfaced in the workspace sidebar. Raw provider errors
stopped in video, music and cartoon. Internal role vocabulary removed from three
403 messages.

**Documents added.** `FEATURE_MATRIX.md`, `AD_SPEND_WALLET.md`,
`MOBILE_APP_RELEASE.md`.

**Verified locally, every commit:** `tsc --noEmit` clean, `eslint` 0 errors,
71/71 tests, `next build` compiles. The `/pricing` fix was additionally checked in
the rendered HTML of a production build.

**NOT verified, and honestly cannot be from here:** anything requiring a signed-in
session. The device shell has no route to Supabase and the cloud container is
likewise blocked, so signup, generation, purchase and refund all remain untested
until someone exercises them on production.

HEAD at end of session: `de2c249f0b090f9fdc87b3053a67c4c3092bc66d`.
