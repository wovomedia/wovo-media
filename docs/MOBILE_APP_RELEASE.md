# WOVO mobile release requirements

**Status: NOT STARTED.** No app project exists. This is what shipping one
actually requires, written so nobody has to rediscover it.

Billing rules below were checked on **2026-09-03** and are the most volatile part
of this document. Re-check them before writing a line of purchase code — see
section 5, which explains why they are moving right now.

---

## 1. Pick the stack before anything else

| Option | Why it might win | Why it might not |
|---|---|---|
| **React Native / Expo** | Closest to the existing React + TypeScript codebase; strong OTA updates; both stores from one codebase. Business logic in `lib/` is plain TypeScript and ports directly. | Native module churn; heavy media handling can need native work. |
| **Capacitor** | Wraps the web app, so the fastest possible path to something installable. | Feels like a website in a shell. Both stores reject apps that are only a repackaged website. This is a real rejection risk for WOVO. |
| **Native (Swift / Kotlin)** | Best media performance and camera/photo handling. | Two codebases, and the smallest amount of reuse from what exists. |

The recommendation, weighing that WOVO is media-heavy but small: **React Native
with Expo**, reusing the credit, pricing and model-catalog modules verbatim.
Decide deliberately, and write the decision down here when it is made.

## 2. Accounts and identifiers

- Apple Developer Program membership (annual, organisation enrolment needs a
  D-U-N-S number — allow real time for this).
- Google Play Console developer account (one-time fee; identity verification).
- Bundle IDs, reserved once and never changed:
  `com.wovomedia.wovo` (iOS) and `com.wovomedia.wovo` (Android).
- Signing: App Store Connect API key and an Android upload key, both stored as CI
  secrets and never committed.

## 3. Store listing assets

Screenshots for every required device size, an icon at every required density, a
short and full description, keywords, a support URL, a marketing URL, and a
privacy policy URL. WOVO already has `/privacy-policy`, `/terms-of-use`,
`/cancellation-refund-policy` and `/contact`, so those slots are covered.

## 4. Privacy and data disclosure

Both stores require a declaration of what is collected and why, and both check it
against actual behaviour.

- Apple **privacy nutrition label** plus, for any third-party SDK on Apple's list,
  a **privacy manifest** and a signature.
- Google Play **Data safety** form.
- Account deletion must be reachable **from inside the app**, not only on the web.
  WOVO already has `/api/account/delete` and `/api/wovo-ai/delete-account`; the
  app has to surface one of them.
- A working **demo account** with credits already on it, in the review notes.
  Reviewers will not sign up, will not verify an email, and will reject for
  "cannot access full functionality" if they cannot get in.

## 5. Purchases — the part that is genuinely in flux

Do not assume the web Stripe flow can simply be embedded. As of **2026-09-03**:

**Apple (US only).** Since the 30 April 2025 injunction in *Epic v. Apple*, US
apps may link out to external payment with **no Apple commission**, no special
entitlement, multiple links, and no mandatory full-screen warning. That is the
current state — but Apple proposed a 15% cut on external purchases in
**August 2026**, the Supreme Court granted certiorari in **June 2026**, and oral
argument was set for **October 2026**. Anything built on today's 0% could change
with one ruling. Outside the US the older rules still apply and in-app purchase
is generally required for digital goods.

**Google Play (US).** Alternative billing and external content links are
permitted, and developers in those programs must report transactions and **pay
service fees starting 1 October 2026**. Budget for a fee, not for zero.

**What this means for WOVO concretely.** Credits and subscriptions are digital
goods, so they are squarely in scope. Three options:

1. **Link out to the existing Stripe flow.** Cheapest today in the US, exposed to
   the Supreme Court ruling and to Apple's proposed 15%.
2. **Native in-app purchase** (StoreKit 2 / Play Billing). Predictable, works
   worldwide, costs 15–30%, and needs the credit ledger to accept a second
   grant source alongside Stripe webhooks — with the same idempotency guarantees.
3. **Ship without purchases at first.** The app creates and views; buying happens
   on the web. Both stores accept this as long as the app does not link to or
   advertise the external purchase path. It is the fastest route to being
   listed and it defers the whole question.

Option 3 is the sane first release. Revisit once the Supreme Court has ruled.

Whichever is chosen, the receipt validation must be server-side and the ledger
grant must be idempotent per transaction ID, exactly as the Stripe webhook path
already is. A replayed receipt must never grant credits twice.

## 6. Review pitfalls specific to WOVO

- **AI-generated content.** Expect questions about moderation. Have an answer for
  what stops someone generating something prohibited, and for how a user reports
  it. `lib/wovo-ai` moderation flags exist; they need to be demonstrably on.
- **User-generated content rules.** If any social surface ships, both stores
  require a content filter, a report mechanism, a block mechanism and a published
  response time.
- **Voice and likeness.** Cartoon voices and likeness profiles need explicit
  in-app consent capture, stored, and a way to withdraw it.
- **Repackaged-website rejection.** A Capacitor shell that is only the web app
  will be rejected. Native navigation, native media picking and offline handling
  are the difference.
- **Age rating.** Answer the questionnaires honestly; an AI image generator with
  open prompts is not a 4+ app.

## 7. Release checklist

1. Stack decided and written down in this file.
2. Both developer accounts open and verified.
3. Bundle IDs reserved.
4. CI signing and upload working.
5. Privacy manifest, nutrition label and Data safety form all filled and matching
   real behaviour.
6. In-app account deletion shipped.
7. Demo account with credits in the review notes.
8. Purchase decision made from section 5 **at the time of submission**, not from
   this document.
9. TestFlight and Play internal testing tracks exercised by a real person on a
   real device.
10. Crash reporting and a way to force-update a broken build.

---

Sources for section 5, checked 2026-09-03:

- [iOS external payments in the US: what they actually cost in 2026](https://tiun.io/blog/ios-external-payments-us-cost-2026)
- [Apple proposes to take a 15% cut of purchases made outside the App Store — TechCrunch](https://techcrunch.com/2026/08/14/apple-proposes-to-take-a-15-cut-of-purchases-made-outside-the-app-store/)
- [An update regarding Google Play's policies for developers serving users in the US](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en)
- [Offering an alternative billing system for users in the United States](https://support.google.com/googleplay/android-developer/answer/16497028?hl=en)
