# WOVO Media — Agent Handoff Notes

Shared scratchpad between Codex and Claude. **Append, don't overwrite.** Date + sign every entry.

Not served publicly — Next.js doesn't route root-level `.md`. Visible to anyone with repo access.

---

## ⚠ The redesign was never pushed to GitHub

Verified 2026-08-01: `github.com/wovomedia/wovo-media/commit/6790c0d…` returns **404**. GitHub's `main` is 2 months behind, last commit `141cb6b`.

Everything the live site currently shows — the whole redesign, `/product`, `/workflow`, `/workspace`, `/portal`, the Meta scaffold — **exists only on this one machine**, in a detached-HEAD worktree. It is not on any remote and not on any named branch. A drive failure loses all of it.

The live deployment therefore did not come from git. Most likely a direct Vercel CLI deploy, which bypasses the GitHub integration entirely.

**Consequences:**

- Committing through GitHub's web UI would stack changes on a 2-month-old base that lacks the redesign. Do not do that.
- `git push` of the real history is the fix, and it needs a shell.
- Until then there is no backup of the redesign anywhere.

**First priority for whoever has a working shell:** get this commit onto a named branch and pushed.

```
git branch redesign-2026-07 6790c0d
git push -u origin redesign-2026-07
```

---

## Repo layout

| Path | What it is |
|---|---|
| `.codex\worktrees\a051\wovo-media` | **Where the current code lives.** Detached HEAD @ `6790c0d`. All work below happened here. |
| `OneDrive\Desktop\wovo-media` | Same git repo, branch `main`. Working tree is **stale** — files on disk are an older layout with a `website/` subfolder. |

Both point at the same `.git`. Desktop's `main` ref already equals the redesign commit; only its checked-out files are behind. `git restore .` from Desktop fixes it (check `git status` first — restore discards uncommitted work).

The redesign sits on a detached HEAD. `git branch redesign-2026-07 6790c0d` would pin it. Cheap insurance.

Repo is inside OneDrive, which syncs `.git` and `node_modules` — causes lock conflicts and cloud-only stubs. `C:\dev\wovo-media` would remove that class of bug.

---

## Current state — verified 2026-08-01 against live wovomedia.com

Vercel project `wovo-media` (`prj_8EOBWflTMlmfhkVNcCIeBWcFtuis`), domains `wovomedia.com` + `www`.

**Shipped and polished:** `/`, `/product`, `/workflow`, `/services`, `/pricing`, `/about`, `/contact`, `/workspace`. Design system is cream `#f2ede7`, near-black `#191714`, orange `#f05a3a`, serif display headlines, numbered `01/02/03` section markers. Owner likes this look — **preserve it**.

**`/portal` is real** — Operations, Clients/Workspaces, Team Inbox, Content Calendar/Queue, Bookings & Services, Billing, Settings/Staff, loading live data.

---

## Already built — do NOT rebuild

Several backlog items already exist:

| Asked for | Lives at |
|---|---|
| Credit system | `lib/wovo-ai/credits.ts` — monthly limit/used, extra credits, monthly reset, `consumePromptCredits()` |
| Buy credits | `app/api/stripe/create-credit-checkout/route.ts`, `app/wovo-ai/buy-credits/` |
| DM infrastructure | `app/api/wovo-ai/social/dm/{threads,messages,block}/route.ts` |
| Voice cloning | `app/api/wovo-ai/voice-clone/route.ts` |
| Video generation | `lib/wovo-ai/sora.ts` |
| Image generation | `app/api/wovo-ai/generate-image/route.ts` |
| Billing / subscription | `lib/wovo-ai/{billing,subscription,access}.ts` |
| Moderation | `lib/wovo-ai/moderation.ts` |

Note: generation credits are consumed via a Postgres RPC, `consume_profile_generation_credit`, not via `credits.ts`. Two parallel credit paths exist — worth reconciling.

---

## Backlog — owner's notes, triaged

### Tier 1 — small

- [x] Fix Google sign-in
- [x] Mandatory logo (all businesses) + food photos (restaurants) — validation and gate done, **upload UI still needed**
- [x] AI DM manager add-on, $1.99/mo — code complete, **dormant until `WOVO_DM_ADDON_PRICE_ID` is set**
- [x] `/support` → `/contact` redirect

### Tier 2 — real features, one plan each

- [ ] Photos → cinematic AI ads. Engine exists (`sora.ts` + `generate-image`); the work is the pipeline. Must serve everyone, not just realtors.
- [ ] Website creation section
- [ ] One-click daily auto-posting, 1–2×/day scaled by credits
- [ ] TikTok / Instagram ad creator
- [ ] Voice conversation — talk to WOVO, it talks back, configures the workspace
- [ ] WOVO Meetings — private meetings + shareable invite links

### Tier 3 — each is its own company

Owner's goal is a one-stop AI platform. All legitimate directions; none is a sprint. Shipping Tier 1–2 well is what funds these.

- [ ] AI coding agent (build sites/apps in-product)
- [ ] Remote-work team platform
- [ ] Job board / contractor hiring
- [ ] Animated series creation
- [ ] Self-hosted AI inference (API-based is the right call for now)

---

## Constraints to design around

Each has a compliant version that's a better product. Build it that way from the start — retrofitting consent and rights checks into a live product with real users is far more expensive.

**Listing photos (the Zillow idea).** Zillow's ToS prohibits scraping, and listing photos are typically copyrighted by the *photographer or brokerage* — not the seller, often not the agent. Generating ads from them exposes WOVO and its users to infringement claims. Compliant path: user-uploaded photos plus a recorded rights attestation. Realtors generally have their own shoots, so this still works commercially.

**Auto-posting without approval.** Conflicts with shipped copy in two places — `/workflow` states *"Generated work enters a visible review queue. WOVO does not imply that external publishing happens without approval"*, and the homepage promises a human in the loop. If auto-post ships, that copy must change or the site is making a false claim. Build on Instagram/TikTok official Content Publishing APIs, never browser automation — that gets user accounts banned.

**Automated DMs.** Meta and TikTok both restrict automated DM sending. Narrow compliant paths exist for business accounts. Scope the $1.99 add-on to what the APIs permit and describe it precisely in marketing copy.

**Voice/likeness cloning.** The Mrs. Hellen precedent was handled correctly — explicit permission. A self-serve version needs per-voice consent captured and stored, or it becomes a deepfake tool.

---

## Conventions

- Next.js App Router, TypeScript, Tailwind. Path alias `@/`.
- Supabase auth + data. Service-role calls via `lib/supabase/server.ts` — never client-side.
- Stripe for subscription + credits.
- Colors: `#f2ede7` cream, `#191714` near-black, `#f05a3a` orange, `#d94326` deep orange for links.
- Section eyebrows: uppercase, letter-spaced, orange.
- Auth UI primitives in `components/auth/auth-frame.tsx` — `AuthFrame`, `AuthDivider`, `authInputClass`, `authPrimaryButtonClass`, `authSecondaryButtonClass`.

---

## Log

### 2026-08-01 — Claude — investigation

Documentation only, no code changes. Located the repo, found the stale-checkout and detached-HEAD hazards, audited all live pages, confirmed the credit/DM/voice/video systems already exist, found Google sign-in shipped disabled.

### 2026-08-01 — Claude — Google sign-in + asset requirements

**Not built, not typechecked, not deployed.** Sandbox VM was unavailable for this entire session, so none of the following has been compiled or run. Treat every line as unverified. Build it before trusting it.

#### Google sign-in — root cause and fix

The PKCE code verifier was written to `localStorage`, which is **origin-scoped**. The site serves both `wovomedia.com` and `www.wovomedia.com` (both listed in `next.config.ts` `allowedOrigins`). An OAuth round trip starting on one host and returning on the other can't see its own verifier, so `exchangeCodeForSession` threw `Missing PKCE code verifier` and the callback redirected to `/login?error=google_auth_failed`. Rather than fix the origin split, the button was removed and replaced with "temporarily unavailable" copy.

Changed:

- `lib/supabase/client.ts` — verifier now stored in a cookie scoped to `.wovomedia.com`, readable from both hosts. `SameSite=Lax` is required (the OAuth return is a top-level cross-site GET; `Strict` would block it), `Secure` on https, 10-minute `Max-Age`. localStorage kept as a fallback for localhost and `*.vercel.app` previews, which get a host-only cookie because `.vercel.app` is a public suffix. A failed exchange now clears the verifier so a dead value isn't reused.
- `next.config.ts` — permanent `www` → apex redirect. One canonical origin. **This also fixes a second latent bug**: the session itself lives in origin-scoped `localStorage`, so a user signed in on apex was silently signed out on www.
- `components/auth/google-button.tsx` — new. Shared button, inline Google mark, uses the existing `authSecondaryButtonClass`.
- `app/login/page.tsx` + `app/signup/page.tsx` — button restored above an `AuthDivider`, "temporarily unavailable" copy removed, `next` param plumbed through so post-login redirect survives OAuth. `oauth_session_missing` and `google_auth_failed` now produce distinct messages instead of one generic string.

**Still needs checking in the Supabase dashboard** (couldn't verify from here): Authentication → URL Configuration must allowlist `https://wovomedia.com/auth/callback`. If the allowlist only has the www form, sign-in still fails after the redirect change.

#### Mandatory logo + food photos

- `lib/wovo-ai/business-requirements.ts` — new. Keyword-matches `businessType` against ~30 food-service terms; every business needs a logo, food-service businesses need ≥3 photos (`MIN_FOOD_PHOTOS`). Returns *all* unmet requirements, not just the first, so the UI can show the full list at once. No React or server imports, so client and server share one source of truth.
- `lib/wovo-ai/business-profiles.ts` — added `foodPhotoUrls: string[]`, deduped and capped at `MAX_FOOD_PHOTOS`. Imports `MAX_FOOD_PHOTOS` from business-requirements; the apparent cycle is safe because that module imports `BusinessProfile` as `import type`, which is erased at compile time.
- `app/api/wovo-ai/businesses/route.ts` — accepts `foodPhotoUrls` on POST/PATCH; every response now carries a `requirements` map keyed by business id. Saving a partial profile is still allowed on purpose — otherwise a user could never save their way toward completeness.
- `app/api/wovo-ai/route.ts` — the actual gate. Returns `428` with the requirement list, placed **before** credit consumption so an incomplete profile never costs a generation. Fails *open* on profile read errors: degraded validation beats a total generation outage if the `goal` column is missing on some deployment.

**Two things left here.** (1) No upload UI for food photos yet — the rules and storage exist, nothing populates them, so restaurants currently hit a `428` they can't clear. Build the uploader before this ships or it's a dead end for food clients. (2) `foodPhotoUrls` deliberately stores hosted URLs, not data URLs: `logoUrl` allows 220KB of inline base64 and the whole profile blob shares one text column capped at 700KB, so two or three inline photos would exhaust it. The uploader needs to write to Supabase Storage and save the returned URL. Migrating `logoUrl` to Storage too would be a good follow-up — it's already most of the budget.

#### $1.99 DM manager add-on

Also unbuilt and untypechecked.

- `lib/stripe.ts` — added `listSubscriptionsForCustomer()` with price data expanded.
- `lib/wovo-ai/addons.ts` — new. Add-on catalog keyed by `AddonKey`; price ID read from `WOVO_DM_ADDON_PRICE_ID`, matching the existing `WOVO_VERIFIED_BADGE_PRICE_ID` pattern.
- `app/api/wovo-ai/addons/route.ts` — new. `GET` returns the catalog with per-user entitlement; `POST` opens Stripe Checkout in `subscription` mode.

Three decisions worth knowing:

1. **Entitlement resolves live against Stripe, not a cached flag.** There is no Stripe webhook route in this app, so a cached flag would never learn about a cancellation made through the billing portal and the user would keep paid access forever. `hasActiveAddon()` fails *closed* — a Stripe outage briefly denies a $1.99 feature, which beats granting it on error.
2. **An add-on with no configured price is invisible.** `getAvailableAddons()` filters on a non-empty price ID, and `POST` rejects anything not in that list. Shipping this before the Stripe price exists is safe: the add-on simply isn't offered.
3. **The description says "drafts replies… for you to approve", not "answers your DMs".** Meta and TikTok restrict automated DM sending. Do not widen that copy without checking what the messaging APIs actually permit for business accounts.

**To activate:** create a recurring $1.99/mo price in Stripe, then set `WOVO_DM_ADDON_PRICE_ID` in the Vercel environment. No code change needed. The DM *drafting* logic itself is still to build — this is the billing and entitlement layer only.

#### Food photos — added a `food` asset kind

`app/api/portal/assets/route.ts` and the portal upload form now accept `food`, distinct from `menu` (a menu is the document; food assets are photos of actual dishes). This reuses the existing prepare → signed-token → Supabase Storage pipeline, which already collects rights and people-consent confirmation.

**Unresolved design fork — needs a decision before more code.** There are now two competing places food photos could live:

1. `foodPhotoUrls` on `BusinessProfile` (added earlier today) — per-user, per-business, serialized into the profile `goal` blob. This is what `findMissingRequirements()` currently reads and what the AI generation context can see.
2. Portal assets — per `account_id`, in Supabase Storage, with rights/consent already captured.

These have different granularity (business vs account) and I could not establish how accounts map to businesses with confidence. **Do not wire the uploader to `foodPhotoUrls` until that mapping is settled** — guessing risks food photos that validate correctly but are invisible to generation, or vice versa. The `food` kind is safe and useful regardless; the reconciliation is the open question.

#### Meta — what already exists

`lib/meta/integration.ts` plus `app/api/integrations/meta/{connect,callback,revoke}/route.ts` are **stubs**, not implementations. The callback returns a hardcoded 501/503; there is no OAuth exchange, no token storage, no publishing. `metaPublishingScaffoldStatus()` reports `launchState: "scaffold_only"`.

Already decided by the scaffold — reuse rather than rename:

| Env var | Purpose |
|---|---|
| `META_APP_ID` | Meta app id |
| `META_APP_SECRET` | Meta app secret |
| `META_TOKEN_ENCRYPTION_KEY` | At-rest encryption for page/IG tokens |
| `WOVO_META_PUBLISHING_ENABLED` | Feature flag, must be the string `"true"` |
| `WOVO_PUBLISH_JOB_PROVIDER` | Background job provider for the scheduler |

Scopes chosen: Instagram Login uses `instagram_business_basic` + `instagram_business_content_publish`; Facebook Login uses `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. Redirect URL is `{siteUrl}/api/integrations/meta/callback` via `metaRedirectUrl()`.

Still to build: OAuth state generation and validation, token exchange, encrypted token storage, Page/IG account discovery, the publisher, and the scheduler.

**Build this with a compiler and a test loop available.** OAuth state validation and token encryption are the two places where an unverified mistake is a security hole against live customer Facebook accounts rather than a visible bug. This is not a good candidate for writing blind.

#### Meta scheduling — plan, not code

Requested flow: generate a week of posts → review them on wovomedia.com → click schedule → posts land on Facebook/Instagram.

Worth noting this flow is *already the compliant design*. It keeps a human approving each post, so it matches the shipped copy on `/workflow` and the homepage. No marketing copy needs to change. Build it exactly as described.

**App Review gates launch, not development.** An earlier version of this note said no code could post until App Review landed. That was wrong — correcting it here so nobody plans around it.

- **App ID + App Secret**: created in minutes in the Meta Developer dashboard. No review.
- **Development Mode**: the app can use `pages_manage_posts` and `instagram_content_publish` immediately, against any account holding a role on the app (admin, developer, tester). **The full pipeline can be built and tested today** against WOVO's own Facebook Page and Instagram.
- **App Review + Business Verification**: required only for *customers'* accounts. This gates public launch. Typically weeks.

Right sequence: build → test in Development Mode against WOVO's own accounts → submit for review with a working demo, which is what Meta wants to see anyway. Review runs in parallel with the rest of the build, so start it once there's something demoable.

Also required: the client's Instagram account must be a Business or Creator account linked to a Facebook Page. Personal Instagram accounts cannot be published to via the API at all. Surface this in onboarding or clients will hit a dead end late.

**The scheduling asymmetry that shapes the design:**

- Facebook Pages support native scheduling — pass `scheduled_publish_time` with `published=false` and Meta holds it.
- **Instagram has no native scheduling.** You create a media container, then call publish. There is no "publish later" parameter. Scheduling has to be your own backend firing at the right moment.

So scheduling cannot be delegated to Meta. Suggested shape:

1. Reuse the existing `content` table — it already has `scheduled_for` and a status flow (`client_review` → `approved` → `queued` → `manual_posted`). Add `queued` → `publishing` → `published` / `failed`, plus columns for the target platform, the connected page/account id, and the returned Meta post id.
2. Week generation writes 7 `content` rows in `client_review`.
3. The portal's existing "This week" view is already most of the review UI.
4. "Schedule" sets `scheduled_for` and moves the row to `queued`.
5. A Vercel Cron route runs every 5–15 minutes, claims due rows, publishes, records the Meta post id or the failure.
6. Make the publish step idempotent and claim rows atomically — overlapping cron runs double-posting to a client's real Instagram is the worst available failure, and it is publicly visible.

Store the page access token encrypted and refresh it; long-lived Page tokens still expire.

**Suggested next:** settle the food-photo data-model fork, start Meta App Review immediately (it gates everything), then build the cron publisher.

---

## 2026-09-02 — Claude: the shared working file moved

Everything about the current state of V2 now lives in one file, kept on the
owner's Desktop so both agents and Payton can open it:

```
C:\Users\1xpay\OneDrive\Desktop\WOVO V2.md
```

**Read it before touching anything.** The short version of why:

1. **The V2 code was on a detached HEAD with no branch.** It is now on
   `wovo-v2` in `C:\Users\1xpay\.codex\worktrees\a051\wovo-media`. GitHub's
   `origin/main` is 46 commits behind and does **not** contain V2.

2. **Deploys are Vercel CLI pushes from that dirty working tree, not GitHub.**
   Triggering a git-based deploy would build `origin/main` and ship the old
   Nova/employee product over the live site.

3. **Migrations drift from deploys and it already cost us production.**
   `20260830164549_wovo_user_signup_credit_grant.sql` was written Aug 30 and
   never applied. The deployed code called the missing RPC on every signup, and
   the catch block deleted the workspace it had just created — so every new
   account was destroyed on creation. Applied and verified 2026-09-02.
   **After writing a migration, apply it and confirm the object exists. A green
   build proves nothing about the database.**

Four commits were added on `wovo-v2` (free-first access, Adam as the default
composer surface, a pricing economics simulator, and a real pricing slider that
stops advertising credit costs the engine never charges). None are deployed yet.

The earlier entries in this file are still broadly accurate, but note that the
"never pushed to GitHub" warning at the top was written on 2026-08-01 about
commit `6790c0d` and was never acted on. The same problem recurred and grew to
46 commits. It is worth actually fixing this time.

— Claude
