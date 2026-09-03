# WOVO feature matrix

**Last updated: 2026-09-03.** Statuses describe what is in the code on branch
`wovo-v2`, not what is intended. Read `AI_HANDOFF.md` alongside this.

| Status | Meaning |
|---|---|
| **WORKING** | Built, and exercised end to end by a person or a test. |
| **PARTIAL** | Built and reachable, but incomplete or unverified in an important way. |
| **DISABLED** | Code exists; a feature flag or missing key keeps it off, and the UI says so. |
| **BLOCKED EXTERNAL** | Waiting on a third party — platform review, API access, a legal or accounting decision. |
| **NOT STARTED** | No implementation. |

A row marked WORKING that has never been run by a human says **PARTIAL** instead.
That rule is why so few rows below say WORKING.

---

## Core product

| Feature | Status | What is actually there |
|---|---|---|
| Auth — sign in / refresh / sign out | **WORKING** | All four flows re-verified in a browser on the deployed build 2026-09-02. |
| Signup → workspace → 10 credits | **PARTIAL** | The path exists and the grant is idempotent in Postgres. Onboarding was rebuilt on 2026-09-03 and has **not** been run by a human since. Verify before trusting. |
| Password reset | **PARTIAL** | Routes and pages exist; not exercised this session. |
| Adam composer (front door) | **PARTIAL** | Live on `/`. Routes prompts to a creation type and shows credit cost first. Intent routing is regex, not a model. |
| Manual create (model, ratio, count) | **PARTIAL** | Model browser, ratios, output count and duration all present in the composer. |
| Image generation | **PARTIAL** | Route, ledger and storage exist and the tab is enabled in production. **No canary run has been done.** |
| Video generation | **PARTIAL** | Enabled in production (12 credits, 720p; 1080p/4K correctly marked unavailable). Job polling route exists. Not run. |
| Music generation | **PARTIAL** | Enabled in production (2 credits, instrumental only). Full song / lyrics / singer are **NOT** built. |
| Cartoon Studio | **PARTIAL** | `lib/cartoon` and `/api/portal/cartoon` exist. Flag state unconfirmed. Character references, voice profiles and episode numbering are **NOT** built. |
| Credit ledger (reserve/finalize/refund) | **PARTIAL** | Implemented with tests for the video and music ledgers. The refund-on-failure path has never been triggered for real. |
| Assets | **PARTIAL** | Persisted per workspace, with download. |
| Projects | **PARTIAL** | `BuildStudio` exists. Adam cannot create, search or open a Project — see the gaps below. |
| Buy credits | **PARTIAL** | Stripe routes exist and price validation passes (12/12). No purchase has been made end to end. |
| Subscriptions | **PARTIAL** | 3 plans × 4 terms validate. Webhook is authoritative. Not purchased end to end. |
| Pricing page | **PARTIAL** | Renders; term selector works. Not re-checked for overlap on mobile this session. |
| Pricing economics | **SAFE** | Worst enabled case is an 81.3% margin at the lowest legitimate revenue per credit ($0.08333) and 100% utilisation. |
| Health endpoint | **WORKING** | Reports database, billing, generation and storage independently. Verified live. |
| Customer-safe errors | **PARTIAL** | `lib/errors/customer-safe.ts` applied to image, caption and chat. **Not yet applied to video, music or cartoon.** |

## Removed on purpose

| Feature | Status | Note |
|---|---|---|
| Owner Command Center / Operations | **REMOVED** | Files deleted; guarded by tests. |
| Staff / employee workspace | **REMOVED from the customer app** | The UI is gone. `mode: "staff"` still exists server-side in the portal API as an authorization concept, and three owner-only endpoints (`/api/portal/adam`, `/api/portal/operator`, owner-gated publishing) still exist and deny everyone. No UI reaches them. |
| Legacy agency client workspace | **REMOVED** | Progress meter, brand-asset gate, support channel, "unlock the working version", cream dashboard — all deleted and pinned by tests. |
| Plan-selection onboarding | **REMOVED** | Replaced by one short screen that creates the workspace and releases the 10 credits. |

## Connections and publishing

| Feature | Status | What is actually there |
|---|---|---|
| Meta (Facebook/Instagram) connect | **PARTIAL** | OAuth callback, status, revoke and webhook routes exist. |
| Meta publishing | **DISABLED** | Behind `WOVO_META_PUBLISHING_ENABLED`; flag state in production unconfirmed. |
| TikTok connect | **PARTIAL** | Connect and callback routes exist. Direct post behind a flag. |
| YouTube connect | **PARTIAL** | Connect and callback routes exist. Publishing behind a flag. |
| **Free tier: 2 connections per platform** | **NOT STARTED** | No per-platform cap and no `extended_social_connections` entitlement anywhere in the code. This is a real gap against the spec. |
| Google Workspace (Gmail, Sheets, Drive, Docs, Calendar, Contacts) | **NOT STARTED** | No OAuth, no routes. |
| Stripe / Shopify / Calendly connectors | **NOT STARTED** | Stripe exists for WOVO's own billing only, not as a customer connector. |

## Brand

| Feature | Status | What is actually there |
|---|---|---|
| Brand profile (voice, audience, goals) | **PARTIAL** | Editable in the workspace and fed into drafts. |
| Brand Brain | **NOT STARTED** | No approved-facts store, no no-go claims, no service area or hours. |
| Brand Guardian (pre-publish check) | **NOT STARTED** | Nothing checks a generation against approved facts. |
| Brand asset generator (logo, PFP, covers, banners) | **NOT STARTED** | No sizes, no safe areas, no deterministic text rendering. |
| Social media kit / full brand kit | **NOT STARTED** | — |

## Adam capabilities

| Feature | Status | What is actually there |
|---|---|---|
| Intent routing | **PARTIAL** | `routeAdamPrompt` classifies create / find / assist with ordered regexes. Tested. |
| Smart follow-up suggestions | **NOT STARTED** | Specified in `docs/ADAM_FOLLOW_UP_SUGGESTIONS.md`; no implementation. |
| Create / search / open a Project | **NOT STARTED** | Adam cannot address Projects at all. |
| Organize assets into Projects | **NOT STARTED** | — |
| Upload from the composer | **NOT STARTED** | The composer takes one reference image; there is no general attachment path. |
| Slash commands, `$connector` mentions | **NOT STARTED** | — |
| WOVO Computer | **NOT STARTED** | No planner, no approval checkpoints, no run state. |

## Revenue Engine

| Feature | Status | What is actually there |
|---|---|---|
| Lead Inbox | **NOT STARTED** | `/api/lead` forwards a form post to an external webhook. It is a contact relay, not an inbox: no storage, no fields, no status. |
| CRM / pipeline | **NOT STARTED** | — |
| 24/7 lead response | **NOT STARTED** | — |
| Appointments | **NOT STARTED** | — |
| Automated follow-up | **NOT STARTED** | `lib/adam/outreach` has unsubscribe handling and a daily-report cron, which is the nearest thing. |
| Missed-call recovery | **NOT STARTED** | Needs a compliant telephony provider. |
| Reviews | **NOT STARTED** | — |
| Reactivation | **NOT STARTED** | — |
| Revenue attribution | **NOT STARTED** | — |

## WOVO Ads

| Feature | Status | What is actually there |
|---|---|---|
| Ad campaign creation | **NOT STARTED** | No code. |
| Meta / TikTok / Google / YouTube / LinkedIn Ads APIs | **NOT STARTED** | The Meta integration is organic publishing, not the Ads API. |
| Ad permission levels | **NOT STARTED** | — |
| Budget calculator, management fee | **NOT STARTED** | — |
| Real campaign status / performance | **NOT STARTED** | — |

## Ad Spend Wallet

| Feature | Status | What is actually there |
|---|---|---|
| Wallet, allocations, reservations, ledger | **NOT STARTED — and deliberately gated** | Designed in `docs/AD_SPEND_WALLET.md`. Holding customer money earmarked for third-party media is a money-transmission and custody question, not a feature flag. It must not ship without the legal and accounting review named in that document. |
| Direct platform billing (lower-risk mode) | **NOT STARTED** | The alternative that avoids custody entirely: the platform bills the customer, WOVO charges only a management fee. This is the one to build first. |

## Clients and surfaces

| Feature | Status | What is actually there |
|---|---|---|
| Web app | **PARTIAL** | Live at wovomedia.com. |
| Desktop app | **NOT STARTED** | — |
| Mobile apps | **NOT STARTED** | Release requirements captured in `docs/MOBILE_APP_RELEASE.md`. |
| Public API | **NOT STARTED** | — |
| Agency mode | **NOT STARTED** | — |

---

## The honest summary

WOVO today is a **generation product with billing**: sign in, describe something,
get an image or a video or a track, download it, buy more credits. That part is
real, and after 2026-09-03 it is no longer wrapped in an agency dashboard.

Everything in Sections 19–24 of the product spec — Revenue Engine, WOVO Ads, the
Ad Spend Wallet, Desktop, Mobile — is **not started**. Not partially built, not
hidden behind a flag: absent. Nothing in the UI claims otherwise, which is the
point of this file.

The nearest real gaps, in the order the spec itself puts them:

1. No image canary has ever been run. The core promise is unverified.
2. Free-tier social connection limits are not enforced at all.
3. Customer-safe errors are missing from video, music and cartoon.
4. Adam cannot touch Projects or Assets.
5. Cartoon Studio has no character references, voices or episode memory.
