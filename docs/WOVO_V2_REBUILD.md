# WOVO Media V2 rebuild audit

**Audit date:** August 30, 2026

**Status:** Phase 0 architecture and production-readiness audit complete; the first contained Phase 1 authorization-hardening and provider-registry slices are implemented locally and verified.

**Scope:** repository, local application, public production health, Supabase migrations and policies, Stripe catalog/integration, AI generation, social publishing, credits, storage, auth, and user experience.

## Executive verdict

WOVO has useful production foundations, but it is not ready for a broad V2 launch. The repository contains at least three generations of the product operating at the same time:

1. legacy WOVO AI profiles, plans, chats, credits, and video jobs;
2. policy-driven AI/operator tables and routes;
3. the newer tenant-safe portal, asset library, immutable credit ledger, approvals, Meta connections, and owner operations system.

The newer portal foundation is the system worth keeping. It already has stronger tenant checks, private assets, atomic credit reservation/refund functions, Stripe webhook idempotency, durable Meta jobs, and approval records. The rebuild should consolidate onto that foundation instead of adding another interface over the old systems.

The immediate priorities are security and data integrity, not a visual rewrite:

- remove authorization decisions based on editable `user_metadata`;
- move all generation onto one job, provider-cost, asset, and credit-ledger path;
- grant the promised 10 free credits once and idempotently;
- pin every publish job to an explicitly selected social connection;
- stop presenting unimplemented music, motion, website, TikTok, and YouTube workflows as working tools;
- archive or isolate legacy routes only after usage and data dependencies are measured;
- then replace the split marketing/portal/admin experience with the V2 workspace shell.

No paid generation or social post was triggered during this audit. The public health endpoint reports database and billing readiness, but provider generation and publishing were not mislabeled as verified.

## Evidence and method

The audit used:

- local source and migration inspection;
- a local Next.js development server and browser checks of public routes;
- a public production health request to `https://wovomedia.com/api/health/portal`;
- production response-header inspection;
- read-only Vercel environment-name inspection;
- read-only live Stripe product/price inspection;
- current official Supabase, Stripe, OpenAI, fal, Meta, TikTok, and YouTube documentation.

Repository inventory at audit time:

| Area | Count / fact |
| --- | --- |
| Next.js pages | 34 |
| API route files | 84 |
| Supabase migrations | 52 |
| Automated tests | No test command or test suite found |
| Main portal implementation | `app/portal/page.tsx`, approximately 6,000 lines |
| Production public health | HTTP 200; database `ready`; billing `ready`; monthly, quarterly, semiannual, yearly periods validated |
| Homepage accessibility | 1 serious automated WCAG violation: insufficient contrast across 16 nodes |
| Local homepage performance | TTFB 99 ms, FCP 152 ms, LCP 164 ms, CLS 0 on the audit machine; local numbers are not field data |

The public homepage response has HSTS and is served through Cloudflare in front of Vercel. The response inspected during this audit did not include a Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`; this should be confirmed across dynamic/authenticated routes before remediation.

## Readiness language

Every feature below uses one of these states:

- **Working:** code, configuration, persistence, and the relevant end-to-end result were verified.
- **Implemented, E2E not verified:** substantial code exists, but this audit did not spend money or trigger an external action to prove production behavior.
- **Prototype:** a partial experience or draft workflow exists without the complete output/delivery path.
- **Not configured:** code exists, but required external configuration or approval is absent or unverified.
- **Not implemented:** no complete product path exists.
- **Unsafe:** a security, authorization, data-integrity, or billing issue blocks production use.

## A. Current architecture

### Application

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Vercel.
- Supabase is used for Auth, Postgres, Storage, and scheduled database jobs.
- Stripe Checkout, Customer Portal, and webhooks handle subscriptions and credit packs.
- OpenAI handles caption/draft/moderation workflows.
- fal handles image and video generation.
- Meta Graph API handles Facebook and Instagram OAuth/publishing.
- Cloudflare currently fronts the domain; it is not a replacement for the Supabase data/auth layer.

### Competing product layers

| Layer | Representative data/routes | Assessment |
| --- | --- | --- |
| Legacy WOVO AI | `profiles`, `subscriptions`, `usage_credits`, `credits`, `video_jobs`, `chats`, `/api/wovo-ai/*`, `/api/wovo/*` | Must be isolated and migrated; non-atomic credits and old plans/models remain |
| AI/operator policy layer | `wovo_ai_creation_jobs`, `wovo_ai_usage_*`, `wovo_ai_operators`, owner Adam tables | Useful policy/job concepts, but overlaps the portal and contains separate entitlements |
| Portal foundation | `wovo_portal_accounts`, members, assets, content, approvals, credit accounts/ledger, Stripe events, Meta connections/jobs | Preferred V2 foundation |

### Recommended target

```text
Authenticated user
  -> selected workspace/account
    -> conversation/composer
      -> immutable generation job
        -> provider registry + quoted cost snapshot
        -> atomic credit reservation
        -> provider execution
        -> private asset persistence
        -> finalize or refund
      -> project/revision
        -> approval
        -> selected social connection(s)
        -> scheduled publish job(s)
        -> provider proof or durable failure
```

The browser should never call fal, OpenAI, Stripe secret APIs, Supabase service-role APIs, or social-provider publishing APIs directly.

## B. Route inventory and ownership

### Public and auth surfaces

- `/` is currently a traditional marketing homepage, not the requested V2 workspace.
- `/product`, `/workflow`, `/services`, `/pricing`, `/contact`, `/about`, case-study, and legal routes are separate marketing pages.
- `/login` and `/signup` use a split marketing/auth layout.
- `/portal` is the primary customer workspace.
- `/admin` and owner operations create separate shells and concepts.
- `/wovo-ai/*` page traffic redirects to `/portal`, while many `/api/wovo-ai/*` APIs remain live.

### Route problems

- There are too many live aliases for checkout, generation, credits, and chat.
- Redirected UI does not mean the legacy APIs are unused or safe to remove.
- The public site advertises tools that are only briefs or are not implemented.
- The owner and customer experiences duplicate navigation and credit concepts.
- Route-level ownership is not documented; safe deletion requires request telemetry first.

### Required route action

Create a route registry with: owner, authentication requirement, tenant requirement, write effects, billable effects, external effects, persistence tables, replacement route, request count, and retirement date. Legacy write routes should become server-side forwarding adapters or return a documented retirement response only after current callers are migrated.

## C. UI and UX audit

### What works

- The coral, cream, and charcoal brand palette is recognizable.
- The local homepage is fast in a development-machine check.
- The portal exposes real saved records rather than only placeholder cards in several areas.
- The newer create flow has destination buttons, output cards, project dialogs, paste/file attachment handling, and private asset concepts.

### What blocks V2 quality

- `/` is a marketing page instead of the signed-in workspace/composer requested for V2.
- The interface has three navigation systems: public nav, portal/creation nav, and owner operations nav.
- `app/portal/page.tsx` is too large to evolve safely or test in isolation.
- Tiny uppercase labels, nested bordered cards, mixed type systems, dense dark panels, and repeated status chips create visual noise.
- Owner-only credit exemptions are visible as infinity or huge balances, contrary to the V2 requirement that owner privileges remain invisible.
- The pricing page immediately opens an email-deal dialog, interrupting comparison and reducing trust.
- Auth copy still contains stale “From $15” language.
- The homepage advertises AI Music, Face-to-Motion, and Website Builder as products even though their execution paths are absent or incomplete.
- Automated accessibility testing found a serious color-contrast failure affecting 16 homepage nodes.
- Several controls use custom text/letter symbols instead of a consistent accessible icon system.

### V2 UX direction

One responsive workspace shell should own `/` after auth:

- left sidebar: New creation, Projects, Assets, Publish, Connections, Billing, Settings;
- top command/composer: prompt, paste/attach, output type, model/quality, credit quote;
- main area: conversation plus current job/result;
- right drawer or modal: selected project, revisions, approvals, destinations, schedule;
- mobile: one-column composer, bottom action, drawers for settings/history.

Signed-out users may explore the composer, but the first billable submission must open auth. Do not create a provider job until account creation and the credit reservation succeed.

## D. Authentication and onboarding

### Current state

- Email/password signup and login are implemented.
- Email verification is required before portal access.
- OAuth callback code exists.
- A Google OAuth button component exists but is not used by the login or signup pages.
- Portal access is resolved through account membership, staff role, owner email configuration, and trusted app metadata.
- A legacy auth trigger initializes old usage records at zero.

### Critical defect

Several admin or privileged decisions fall back to `user.user_metadata.role`. Supabase documents that `raw_user_meta_data` can be updated by the authenticated user and is not suitable for authorization; trusted authorization belongs in database membership/role rows or `raw_app_meta_data`. Affected code includes admin authorization, admin-recipient resolution, dashboard role display with operational effects, badge resolution, support admin discovery, and legacy profile role resolution.

This is a **P0 privilege-escalation risk**. User-editable profile fields such as display name/avatar may stay in user metadata; roles, billing exemptions, admin status, and feature grants may not.

### Missing V2 behavior

- A database-idempotent one-time grant of 10 free credits is implemented locally as of August 30, 2026 and is pending migration/deployment.
- Google sign-in is not exposed.
- The signed-out root composer/auth modal flow does not exist.
- Owner privileges are surfaced in the interface.
- Onboarding, account creation, billing selection, and the old preview path overlap.

### Required design

1. Create the auth user.
2. Create or accept one workspace membership transactionally.
3. Create the account credit ledger if absent.
4. Insert an idempotent `signup_grant` of 10 credits using a unique reference such as `signup:<user_id>`.
5. Never grant again for login, email change, account recreation, or webhook replay.
6. Keep roles in account membership and trusted app metadata only.
7. Open the workspace with a visible balance of 10 and no hidden provider job.

## E. Database, tenancy, RLS, and migrations

### Strengths

- Newer portal, Adam, AI, and Meta tables generally enable RLS and deny direct anonymous/authenticated mutation in favor of server routes.
- Tenant access helpers are reused by newer policies.
- Newer credit operations use database functions, advisory locking/idempotency, an immutable ledger, reservations, finalization, and release/refund.
- Meta tokens are encrypted before storage.
- Newer content and publishing workflows record approvals and provider proof.

### Risks

- Fifty-two migrations represent multiple overlapping schemas rather than a single current model.
- Credits exist in several tables and are consumed using incompatible rules.
- Subscription state exists in legacy and portal tables.
- Generated media paths mix user IDs and account IDs.
- Legacy authenticated policies permit direct access to tables that the V2 server-only model should isolate.
- Security-definer functions and every exposed-table grant need a dedicated migration audit, including explicit `search_path` and least privilege.
- Supabase announced that public-schema tables are no longer automatically exposed for new projects and enforcement for existing projects changes on October 30, 2026. WOVO must explicitly audit grants and API exposure rather than relying only on RLS.
- The live production RLS/table state was not independently dumped in this Phase 0 environment because the production service credential is write-only through Vercel. Migration inspection is not a substitute for a production catalog audit.

### Canonical V2 data model

Keep or create one canonical set:

- `accounts`
- `account_members`
- `projects`
- `project_revisions`
- `conversations`
- `messages`
- `assets`
- `provider_models`
- `generation_jobs`
- `generation_attempts`
- `credit_accounts`
- `credit_ledger`
- `subscriptions`
- `purchases`
- `social_connections`
- `publish_jobs`
- `approvals`
- `audit_events`

New V2 tables should be introduced by additive migrations. Data should be backfilled and reconciled before any legacy table or route is removed.

## F. Storage and asset handling

### Current state

- `wovo-portal-assets` is private.
- Tenant paths and signed URLs are used for newer portal assets.
- fal outputs are copied into Supabase rather than relying permanently on provider URLs.
- Asset records include rights and people-consent concepts.
- Signed URLs are short-lived.

### Gaps

- Legacy video output paths are user-scoped while newer assets are account-scoped.
- The image downloader accepts any HTTPS provider result URL; provider downloads should use an allowlist, DNS/IP safety, redirect limits, byte limits, and content-type validation.
- Project chat receives attachment metadata but does not pass actual image content to a vision-capable model, so “use this pasted logo” can be acknowledged without the model seeing it.
- There is no single lineage view from input assets to job attempt to output asset to publish job.

### V2 asset rule

Every input and output asset must store account, creator, job, provider, model, content type, byte size, checksum, dimensions/duration, rights/consent status, source lineage, moderation state, and storage object. Downloads and publish URLs must be authorized server-side.

## G. AI generation providers

### Image + caption

**State: Implemented, E2E not verified in this audit.**

The newer `/api/portal/generate-post` path:

- authenticates and verifies account access;
- checks rights confirmation;
- atomically reserves 12 portal credits;
- moderates input;
- drafts a caption with exactly three hashtags using OpenAI;
- generates an original image through fal;
- persists the asset and content record;
- finalizes on success and releases credits on failure.

Problems:

- provider/model IDs and the assumed actual cost are hard-coded;
- the exact pricing of the `fal-ai/flux-2` alias is not resolved into a versioned registry;
- OpenAI model choices are duplicated across routes;
- legacy image/chat routes still use older `gpt-4o` and `gpt-4o-mini` paths and older credits;
- production key names exist, but provider success was not proven without a paid request.

### Video

**State: Unsafe for broad production use.**

The video route submits fal Wan 2.2 jobs, polls them, copies results to private storage, and supports text-to-video/image-to-video concepts. It is feature-gated.

Blocking issues:

- normal video consumes the legacy credit system instead of the portal ledger;
- a provider failure can leave consumed credits without the portal reservation/refund guarantee;
- polling can report warnings without durably closing the job as failed;
- job/account/asset lineage is fragmented;
- requested duration metadata is not consistently passed to the provider endpoint;
- production provider behavior was not verified in this audit;
- model and cost are hard-coded rather than snapshotted at job creation.

### Cartoon

**State: Prototype / gated integration.**

There is a real brief/episode workflow and a fal-backed video path, but separate cartoon entitlements/prices remain even though the intended product includes cartoons with the main credit system. It must join the canonical generation job and credit model.

### Adam text and project chat

**State: Multiple overlapping implementations.**

There are legacy chat routes, portal project chat, portal operator jobs, and owner Adam operations. Some are metered, some are not. Model IDs and estimated token costs differ. Project chat can reference an attachment record but cannot inspect the pasted image bytes.

### AI music and music video

**State: Not implemented.**

The product card and brief language exist. No complete music provider, generation job, output asset, moderation, credit debit, or download/publish workflow was found.

### Face-to-motion / voice cloning

- Face-to-motion: **Not implemented**; the replace-dance execution path fails closed.
- Voice cloning: **Not configured prototype**; a generic proxy requires a separate provider URL and entitlement. A per-request consent checkbox exists in part of the old flow, but provider readiness and durable consent evidence are not established.

### Website builder

**State: Prototype.** It produces planning/draft concepts, not a complete block editor, deployment, domain, preview, versioning, and rollback product.

## H. Generation jobs and reliability

### Current strengths

- Newer AI usage requests and creation jobs support reservation, completion, failure, caps, and audit data.
- Meta uses durable jobs and sanitized failure summaries.
- Provider outputs are persisted privately.

### Missing foundation

- No single job state machine serves image, video, cartoon, music, text, and revisions.
- No durable queue/worker abstraction handles long-running generation consistently.
- Provider webhooks, polling, retries, timeout, cancellation, and idempotency rules vary by route.
- Model availability and price are not versioned centrally.
- There is no automated reconciliation between provider jobs, output assets, and credit reservations.

### Required state machine

`quoted -> reserved -> queued -> running -> succeeded | failed | canceled | expired`

Rules:

- only `reserved` may submit to a paid provider;
- submit must be idempotent by job ID;
- every attempt records provider request ID and sanitized error code;
- success stores the durable output before finalizing credits;
- every terminal failure releases the reservation exactly once;
- a sweeper expires stranded reservations and reconciles provider status;
- retries either reuse the quoted price or require explicit re-quote if model/cost changes.

## I. Credits and metering

### Current systems

1. legacy profile/subscription counters with non-atomic read/update paths;
2. older generation-credit RPCs and weekly limits;
3. the newer account-level credit account, immutable ledger, and reservation/finalize/release RPCs.

The third system is the V2 foundation.

### Current product facts

- Current public plans promise 100 credits every seven days for each billing period.
- Current standalone packs are 50 credits for $5, 110 for $10, and 300 for $25.
- Packs do not require an active subscription in the newer checkout code.
- The current post + image path charges 12 credits.
- Owner interfaces visibly represent unlimited/exempt usage, contrary to the V2 owner-visibility requirement.

### Required fixes

- one ledger for free grants, subscription grants, pack purchases, reservations, consumption, refunds, expiration, and manual adjustments;
- one unit definition and a versioned price table per model/output configuration;
- no owner balance mutation or “infinite credit” row; bypass authorization can be server-side and invisible;
- a one-time 10-credit signup grant;
- reserve before provider submission and refund every terminal failure;
- show an exact quote before generation and the charged/refunded entry after completion;
- store estimated and actual provider cost independently of customer credits.

## J. Stripe, pricing, and catalog

### Current integration strengths

- Checkout Sessions are used rather than collecting card data directly.
- Payment method types are omitted, allowing Stripe dynamic payment methods.
- Subscription plan IDs/amounts/cadence are allowlisted server-side.
- Credit-pack checkout does not require a subscription.
- Webhooks verify the raw request signature and use an event table for idempotency.
- Credit-pack fulfillment verifies the exact line item, Stripe price, amount, and units before atomically granting credits.
- Checkout is tenant-bound and membership is rechecked.
- The public health route verifies the current four subscription prices.

### Current catalog facts

The current intended WOVO Workspace product has:

| Period | Charge | Effective monthly |
| --- | ---: | ---: |
| Monthly | $44.99 | $44.99 |
| Every 3 months | $119.97 | $39.99 |
| Every 6 months | $209.94 | $34.99 |
| Yearly | $359.88 | $29.99 |

Standalone packs:

| Pack | Price | Revenue per credit |
| --- | ---: | ---: |
| 50 | $5 | $0.1000 |
| 110 | $10 | $0.0909 |
| 300 | $25 | $0.0833 |

### Catalog and product problems

- The live account contains 92 active prices and many duplicate/obsolete WOVO products.
- Old $15/$36/$120 workspace prices remain active alongside current prices.
- A separate $39.99/month Cartoon Episodes product remains active, contradicting the intended all-tools credit model.
- A separate AI Operator product at $199/month and longer periods remains active.
- Legacy code still declares Starter/Growth/Pro plans at $24.99/$49.99/$99.
- Auth UI still says “From $15.”
- The pricing email pop-up appears immediately.
- Active catalog clutter increases support and accidental-selection risk even though the newer server allowlist protects current checkout.
- Stripe Tax behavior and registrations must be decided explicitly; Checkout does not make tax compliance automatic by itself.

### Required Stripe action

Do not delete Stripe objects. Build a catalog reconciliation report, map every active customer/subscription to its price, mark grandfathered prices, update customer-facing copy, then archive unused products/prices through an owner-approved operation. Preserve webhook idempotency and exact price verification.

## K. Social connections and publishing

### Meta (Facebook and Instagram)

**State: Implemented, current production E2E not re-verified in this audit.**

Strengths:

- official Facebook Login for Business flow;
- encrypted token storage;
- Graph API versioning;
- multiple connection rows are supported;
- approval and scheduling states are durable;
- provider IDs and publish proof are stored;
- Facebook image/text publishing exists;
- Facebook Reels uses the start/upload/finish flow;
- Instagram uses container/status/media publish, including Reels;
- the worker processes only a recent 75-minute delivery window, preventing a stale catch-up burst;
- errors are sanitized and persisted.

Problems:

- several helper paths load only the first matching connection;
- owner/manual creation cannot consistently select an exact connection ID;
- a publish job may be rebound to a default connection instead of remaining pinned to the user-selected destination;
- daily automation still creates image-oriented scheduled content rather than the intended video-first workflow;
- live provider proof and the current production queue were not re-read in this environment;
- enabling automation before one explicitly selected, owner-approved E2E slot is unsafe.

Required rule: a project selects one or more exact `social_connection_id` values. Scheduling creates one publish job per destination. That ID is immutable after approval unless a user explicitly replaces the destination and re-approves.

### TikTok

**State: Not implemented and externally gated.**

UI labels are not an integration. TikTok Direct Post requires a registered app, user authorization, approved `video.publish` scope, correct creator/account UX, and audit before public posts. An unaudited client is restricted. WOVO needs both product implementation and TikTok approval.

### YouTube

**State: Not implemented and externally gated.**

No OAuth connection, refresh-token storage, channel selector, resumable upload, metadata workflow, or quota handling was found. YouTube upload requires user OAuth consent and the upload scope; ordinary service accounts are not supported for normal channel uploads.

### Download/export

Generated assets should always offer an authorized download when policy allows, independent of social connection availability. Publishing must never be represented as available for TikTok/YouTube until those providers are configured and approved.

## L. Adam assistant

### Current state

Adam appears as:

- legacy consumer chat;
- project chat;
- a portal operator with draft/confirmation states;
- a large owner operations assistant and reporting system.

The implementations use different models, costs, permissions, context stores, and credit rules.

### V2 role

Adam should be the conversation layer over the same project and job APIs available to explicit UI controls. Adam may:

- create and revise briefs;
- quote generation cost;
- ask for confirmation;
- submit a generation job after confirmation/reservation;
- retrieve projects and assets in the selected tenant;
- draft captions and hashtags;
- create approval-ready schedules;
- explain provider/job failures.

Adam must not bypass workspace membership, consent, credits, moderation, connection selection, approval, or publish policy. Tool calls and resulting mutations must have durable audit events. Attachments intended for visual reasoning must actually be delivered to a supported vision model, not only named in text.

## M. Security and privacy

### P0

- Remove every privileged fallback to user-editable `user_metadata`.
- Audit all legacy authenticated table grants and RLS policies.
- Audit every security-definer function for a fixed empty/private `search_path` and least-privilege execution grants.
- Enforce exact account membership in every write route.
- Consolidate credits before enabling video broadly.
- Add rate limits to auth, generation, upload, connection, schedule, and webhook-sensitive paths.
- Restrict provider download hosts and validate redirect/content/size/checksum.
- Add CSP and other missing response security headers after testing required provider domains.
- Ensure logs never contain social tokens, provider keys, full captions with sensitive data, or raw uploaded media.

### Consent and safety

- Rights and people/voice consent must be durable records tied to the asset/job, not only terms-page prose.
- A checkbox or confirmation is still required when a user uploads a person, face, body, or voice for synthesis.
- Voice/face workflows require abuse prevention, age restrictions, takedown, and audit before launch.
- Provider moderation results and policy version should be stored without leaking disallowed content into operational logs.

## N. Observability, testing, and deployment

### Current state

- Public database and billing health checks exist.
- Meta jobs store attempts, provider proof, and sanitized failures.
- AI usage tables contain cost and request concepts.
- Vercel and Supabase cron mechanisms exist.
- No automated test suite or test command was found.
- No unified dashboard reconciles job, provider, asset, ledger, and publishing state.

### Required gates

- unit tests for quoting, permission checks, state transitions, and refund idempotency;
- database tests for RLS, cross-tenant denial, duplicate grants, webhook replay, and concurrent reservations;
- contract tests for provider response parsing;
- integration tests with mocked OpenAI/fal/Meta/Stripe;
- browser tests for signup -> 10 credits -> quote -> generate -> asset -> revise -> download;
- browser tests for connection selection -> approval -> schedule without sending a real post;
- one owner-authorized canary E2E per provider before “Working” status;
- alerts for stuck reservations/jobs, cost spikes, webhook failures, expired social tokens, and publish error rate;
- rollback documentation for each migration and feature flag.

## O. Provider costs and profitability

Provider prices change. V2 must read them into a versioned registry and store the quote snapshot on each job. The current audit reference points are:

| Work | Current reference | Direct provider reference cost |
| --- | --- | ---: |
| Caption with `gpt-5.6-luna` | $0.20/M input, $1.20/M output | A 1,000-input/400-output example is about $0.00068 |
| fal FLUX.2 image | Variant-dependent | About $0.012–$0.07 per megapixel depending on the selected FLUX.2 variant |
| fal Wan 2.2 A14B Turbo video | 720p output | $0.10 per video at the audited endpoint |

The exact alias/model/version and billed units must be captured. A hard-coded `$0.05` image cost is not an accounting source of truth.

### Subscription unit economics

At 100 credits every seven days, full usage is about 434.5 credits per average month.

| Period | Effective monthly revenue | Revenue/credit at full use | Max provider cost/credit for 80% direct gross margin |
| --- | ---: | ---: | ---: |
| Monthly | $44.99 | $0.1035 | $0.0207 |
| Every 3 months | $39.99 | $0.0920 | $0.0184 |
| Every 6 months | $34.99 | $0.0805 | $0.0161 |
| Yearly | $29.99 | $0.0690 | $0.0138 |

Illustrative current economics before Stripe fees, storage/egress, support, refunds, tax, moderation, and infrastructure:

- 12-credit image + caption at a conservative $0.05 provider cost has roughly $0.83–$1.24 of credit value depending on plan/pack.
- A $0.10 video needs at least 8 credits at the annual full-use rate to keep 80% direct provider margin; 16–24 credits provides more room for storage, retries, moderation, and price changes.
- A future expensive model cannot be included at the same credit price without a versioned multiplier.

### Pricing recommendation

Keep the four current billing periods and standalone packs during consolidation. Do not add more plan tiers. All tools should draw from credits; model/quality/duration determines the credit quote. Grandfather existing paid customers deliberately. Do not advertise unlimited generation.

Before changing prices, add a simulator with assumptions for utilization, output mix, provider retries, Stripe fees, storage/egress, refunds, taxes, customer support, and churn. Require a minimum contribution-margin threshold per model configuration.

## P. Production readiness matrix

| Capability | State | Launch blocker |
| --- | --- | --- |
| Email/password auth | Working with incomplete onboarding | No one-time free grant; split product flow |
| Google auth | Not implemented in live UI | Dead component only |
| 10 free credits once | Not implemented | Must use idempotent canonical ledger grant |
| Tenant membership | Working in newer portal | Legacy routes/policies still coexist |
| Private asset storage | Working in newer portal | Mixed legacy paths; downloader hardening needed |
| Caption + original image | Implemented, E2E not verified | Hard-coded model/cost; provider canary needed |
| Video creation | Unsafe | Legacy credits, incomplete refund/reconciliation |
| Cartoon creation | Prototype | Separate entitlement and noncanonical job path |
| AI music/music video | Not implemented | No provider/job/asset/credit path |
| Face-to-motion | Not implemented | No execution path; consent/abuse program absent |
| Voice cloning | Not configured prototype | Provider, consent evidence, safety review |
| Website builder | Prototype | No real editor/deployment/versioning |
| Adam project assistant | Prototype/overlapping | Context, metering, attachment vision, tools fragmented |
| Stripe subscriptions | Working for current allowlist | Catalog clutter and stale copy |
| Standalone credits | Working in newer flow | Must consolidate legacy balances |
| Meta OAuth | Implemented, current E2E not re-verified | Connection selection inconsistencies |
| Meta approval/scheduling | Implemented | Exact destination pinning and canary required |
| Meta automation | Not ready to expand | Image-oriented automation; live queue not re-audited |
| TikTok publish | Not implemented | Code + app review/scope approval |
| YouTube publish | Not implemented | OAuth, channel UX, upload, quota |
| Accessibility | Not ready | Serious homepage contrast violation |
| Automated tests | Not implemented | No regression/security suite |
| Owner UI invisibility | Not implemented | Owner credit/operations UI is visible |

## Prioritized backlog

### P0 — block launch and paid scaling

1. Remove user-metadata authorization fallbacks.
2. Add route telemetry and freeze new work in legacy write paths.
3. Create the canonical provider/model/cost/credit quote registry.
4. Move video to the portal reservation/finalize/refund ledger.
5. Add idempotent one-time 10-credit signup grants.
6. Perform a production schema/grant/RLS/security-definer audit using a read-only database role.
7. Pin publish jobs to exact selected social connection IDs.
8. Reconcile Stripe catalog and stale pricing copy without deleting customer history.
9. Add a durable generation worker/state machine and stranded-reservation sweeper.
10. Stop or relabel claims for music, face motion, website publishing, TikTok, and YouTube.

### P1 — core V2 experience

1. Build the single responsive workspace shell.
2. Make `/` the workspace and use the signed-out composer-to-auth flow.
3. Split the 6,000-line portal into feature components and server boundaries.
4. Build one composer with output-specific controls and a preflight credit quote.
5. Add project/revision/chat/attachment views backed by real assets and jobs.
6. Add explicit account/connection selection and multi-destination scheduling.
7. Add download/export, approval, and job-failure recovery.
8. Replace visible owner credit UI with server-side policy.

### P2 — provider expansion and quality

1. TikTok app registration, audit, OAuth, creator info, and Direct Post.
2. YouTube OAuth, channel selection, resumable upload, metadata, and quota handling.
3. Production analytics, provider/cost dashboards, and reconciliation alerts.
4. Accessibility, keyboard, responsive, and content-design pass.
5. Stripe catalog archival after customer mapping.

### P3 — lower-priority products

1. AI music and synchronized music video.
2. Cartoon character continuity and voice workflows.
3. Face-to-motion with a dedicated safety/consent program.
4. Real block-based website builder, preview, deploy, and rollback.

## Staged rebuild plan

### Phase 0 — audit and containment (this document)

**Complete:** route/data/provider/billing/UI audit and target architecture.

**Remaining operational gate:** obtain a read-only production database inspection path and capture current schema/RLS/grants/job/ledger facts without exposing credentials.

### Phase 1 — security and canonical foundation

- remove editable-metadata authorization (**completed locally August 30, 2026; pending deployment**);
- create route ownership/retirement registry;
- introduce provider/model/cost registry (**completed locally August 30, 2026; image/video model IDs, pricing versions, customer-credit quotes, and provider-cost estimates are centralized; pending deployment**);
- define canonical generation job and asset lineage;
- create idempotent signup grant (**completed locally August 30, 2026; pending migration/deployment**);
- move video reservation/refund into the portal ledger (**completed locally August 30, 2026 for the client-polled legacy fal endpoint; pending migration/deployment, a background reconciler, and live provider canary**);
- add unit/database tests for roles, grants, reservations, refunds, and cross-tenant access.

**Exit gate:** all billable image/video jobs use one ledger and state machine; no role is derived from user metadata; free credit replay and cross-tenant tests pass.

### Phase 2 — workspace shell and core generation

- replace the root experience with the V2 shell;
- composer-to-auth flow;
- real image/caption/video jobs, progress, project revisions, paste/attach, and downloads;
- exact credit quote and transaction history;
- no visible owner exemption UI.

**Exit gate:** browser E2E passes signup -> grant -> image/video -> persist -> revise -> download; provider failure proves exact refund.

### Phase 3 — connections, approval, and Meta publishing

- connection manager with all authorized Pages/Instagram accounts;
- immutable selected destination IDs;
- approval and schedule experience;
- canary Facebook image/Reel and Instagram image/Reel;
- automation remains off until owner canary proof and error-rate alerting pass.

**Exit gate:** one explicitly approved job per supported Meta format has provider proof; no stale backlog is sent.

### Phase 4 — billing/catalog and launch readiness

- pricing simulator and contribution-margin gates;
- stale-copy cleanup and deliberate grandfathering;
- catalog reconciliation/archive proposal;
- security headers, rate limits, accessibility, observability, support runbooks, rollback drills.

**Exit gate:** security/test/accessibility launch checklist passes and every public product claim maps to a working feature.

### Phase 5 — TikTok, YouTube, then lower-priority creation tools

- complete external app reviews and OAuth/publishing integrations;
- add music, advanced cartoons, motion/voice, and websites one at a time through the canonical job/asset/credit system.

**Exit gate:** each provider has a canary, cost model, refund path, abuse controls, and support runbook before being marketed.

## Immediate Phase 1 change boundary

The first implementation slice should be deliberately small:

1. remove `user_metadata` from every privileged role/admin decision (**complete locally**);
2. preserve user metadata only for non-authoritative profile fields (**complete locally**);
3. add regression tests for a user who sets `user_metadata.role = admin` or an owner email and must remain unauthorized (**5 authorization tests passing**);
4. run typecheck, lint, and production build (**passing: 0 lint errors, production build generated 106 routes**);
5. do not alter provider flags, publish queues, Stripe products, credits, or production data in that slice.

The next contained Phase 1 slice also established a code-level provider/model registry:

- OpenAI caption and fal image/video model IDs now resolve from one versioned registry;
- social image posts snapshot both model IDs, pricing versions, registry version, estimated provider cost, and 12-credit quote before reservation;
- completed caption token usage is included in the reconciled provider-cost estimate;
- video job metadata snapshots the model, pricing version, registry version, estimated provider cost, and proposed 24-credit quote without changing the legacy video debit path;
- unpriced generic model overrides no longer silently inherit another model's cost;
- four provider-registry tests pass, for nine Phase 1 tests total.

The following contained Phase 1 slice established the signup credit grant:

- the grant is uniquely keyed by the authenticated user ID, not by login attempt or workspace;
- the service-only RPC takes a per-user transaction lock and reuses the canonical portal credit ledger;
- onboarding applies the grant only after workspace membership exists and deletes the incomplete workspace if the grant fails;
- account deletion preserves the user-level grant marker, preventing delete-and-recreate credit farming;
- three source-level grant invariants cover the user uniqueness, fixed 10-credit value, browser-role revocation, RLS, and onboarding order.

The following contained Phase 1 slice moved paid fal video onto the canonical tenant ledger:

- credit-only customers are no longer blocked behind the retired legacy Pro-plan check;
- every paid request requires an explicit workspace and atomically binds one 24-credit reservation to one durable video job before fal submission;
- provider completion finalizes usage only after the MP4 is in private storage;
- submission failure, or provider failure observed during authenticated polling, calls an idempotent database release, while complimentary one-per-workspace previews remain unbilled and watermarked;
- five video-ledger regression tests cover reserve order, durable bindings, service-only RPCs, private-storage-before-finalize, and failure release;
- no provider render was submitted during this implementation; a background reconciler and live canary remain deployment exit gates so jobs do not depend on an open browser.

## Source references

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API exposure breaking change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe dynamic payment methods](https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods)
- [OpenAI GPT-5.6 Luna model pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [fal FLUX.2 pricing](https://fal.ai/flux-2)
- [fal model pricing API](https://fal.ai/docs/platform-apis/v1/models/pricing)
- [fal Wan 2.2 A14B Turbo text-to-video](https://fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video/turbo)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [YouTube OAuth for web server applications](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [YouTube Data API revision history](https://developers.google.com/youtube/v3/revision_history)

## Final Phase 0 decision

Proceed with Phase 1 foundation work. Do not begin a broad visual rewrite, enable automated publishing, spend provider credits for smoke tests, archive Stripe products, or delete legacy tables/routes until the corresponding gate above is satisfied and an owner-approved canary or migration plan exists.
