# WOVO Media — master product definition

Owner spec, captured 2026-09-02. This is the north star. Where existing code
conflicts with it, migrate / remove / redirect the code.

## Identity

WOVO Media is an **AI marketing and business operating platform** — an AI
marketing employee and business assistant.

It must not feel like: a traditional agency dashboard, an internal employee
portal, an Owner Operations system, a generic SaaS admin panel, only an image
generator, or only a video generator.

Users can **do the work themselves**, **ask Adam to help**, or **give WOVO
Computer the outcome** and let it coordinate.

## Hard rule — the old product does not come back

Never maintain or recreate: WOVO Operations · Owner Command Center · Owner
Dashboard · Owner Operator Panel · President/Owner workspace · Owner Access ·
OWNER EXEMPT UI · ∞ credits UI · Adam Operations · employee accounts as a
product · employee dashboard · staff portal · staff workspace · Settings/Staff ·
Team Inbox operator system · Clients/Workspaces operator system ·
Bookings & Services operator system · a separate founder application · a
separate client portal product · the old private workspace concept.

**The founder uses the same normal WOVO customer product.**

*(Status: done — the whole tree was deleted 2026-09-02 in commit `b0cf99d`, with
a test that fails if any of it returns.)*

## One product

One application. Possible navigation:

CREATE / ADAM · COMPUTER · EXPLORE · CONTENT (Calendar, Assets, Projects) ·
ENGAGE (Inbox, Analytics) · BUSINESS (Outreach, Connections, Brand) ·
DEVELOPERS (API, API Keys, Usage, Docs) · SUPPORT · SETTINGS

No multiple permanent application shells.

## Internal admin

Allowed only as hidden protected infrastructure: `/internal`, `/internal/models`,
`/internal/model-economics`, `/internal/pricing`, `/internal/jobs`,
`/internal/support`, `/internal/billing`, `/internal/launch-status`,
`/internal/agency`. Never in customer navigation. Not a second product.

## The products

1. **Adam / universal input** — the main intelligent interface. Home is not
   image-only. Prompt: *"Ask Adam anything or tell WOVO what you want to
   accomplish..."* Adam determines the workflow: content, prompts, model choice,
   campaigns, strategy, research, project/asset/chat search, business questions,
   connected-app tasks, email, outreach, spreadsheets, calendar, documents,
   Computer task creation.
2. **Create** — image, video, music, social, cartoon, characters, editor,
   website creative, campaign creative. Progressive disclosure; not every
   technical setting by default. Manual mode must stay available for power users
   (model, prompt, resolution, duration, ratio, audio, references, outputs) with
   no forced Adam orchestration.
3. **Assets** — every successful creation persists. Open · Download · Edit ·
   Variation · Use in Post · Use in Video · Add to Project · Schedule · Publish.
4. **Projects** — assets, chats, posts, videos, campaigns, files, computer
   tasks, activity, calendar items. Adam understands active project context.
5. **Chat / WOVO memory** — searchable workspace conversations, attachable to
   projects. "Find the chat where we planned the fish fry."
6. **Brand Brain** — authorized business context so users never re-explain their
   business.
7. **Brand Guardian** — checks name, hours, address, phone, prices, offers,
   event dates, tone, approved claims and logo usage before publishing.
8. **Campaign memory** + content-fatigue detection + performance memory.
9. **Calendar** — Ideas · Generating · Draft · Needs Review · Scheduled ·
   Publishing · Published · Failed. Month/Week/List. Server-side scheduling.
10. **Social publishing** — Facebook Pages, Instagram professional, TikTok,
    YouTube. Multiple accounts per workspace. Independent jobs per network: one
    failure must not fail the others. Plus a social composer that adapts copy per
    platform.
11. **WOVO Computer** — give it the outcome, it figures out the work. Modes
    Quick / Balanced / Deep. Respects a credit budget. Persistent task statuses
    (planning, awaiting approval, queued, running, waiting on dependency,
    waiting on user, partially complete, completed, failed, cancelled). **No fake
    progress percentages.**
12. **Guided business tasks** — categories rather than requiring perfect prompts:
    Content & Marketing · Sales & Outreach · Email & Inbox · Research ·
    Documents · Spreadsheets · Calendar & Meetings · Business Operations.
13. **Slash commands** — `/image /video /ad /social /website /character /cartoon
    /music /project /search /research /outreach /email /calendar /sheet /doc
    /report /campaign /week /month /computer`. Optional; natural language still
    works.
14. **Connector mentions** — `$gmail $calendar $sheets $drive $docs $contacts
    $stripe $shopify $calendly`.
15. **Connections** — Google Workspace first.
16. **Email management** — draft first, always. Never silently send or delete.
17. **Outreach** — research, qualification, personalised outreach, follow-up,
    pipeline. Modes: Research Only / Draft Only / Review + Send / Automated
    Follow-Up. Never a spam cannon; respect opt-outs, bounces, do-not-contact and
    send limits. Never fabricate contact information.
18–20. **Sheets / Drive & Docs / Calendar & meetings assistants.**
21–24. **Make My Week · Make My Month · Content Budget Mode · Goal Mode.**
25–28. **Credit Optimizer · Maximize Quality · Model Battle · Quality Check.**
29–38. **One idea → full campaign · Event campaign mode · Promotion engine ·
    Seasonal opportunities · Fix this post · Screenshot → campaign · One asset →
    every platform · Safe area engine · Auto branding · Campaign score.**
39–42. **One approval screen · Content inbox · Daily brief · Weekly report.**
43. **AI music** — complete songs, not just instrumentals. Adam can determine
    title, lyrics, genre, tempo, instrumentation, structure, singer, duration and
    model, then generate a full song with vocals. Modes, lyrics editor, singer
    options. Never pretend a model supports a saved singing voice if it does not.
44–46. **Voice profiles · Likeness profiles · People & character library**, each
    requiring explicit per-feature authorization beyond the general Terms.
47. **AI editor.** 48. **WOVO API** (`wovo_test_` / `wovo_live_` keys,
    workspace-scoped, revocable, rate-limited; customers use WOVO model IDs and
    never see provider routing).
49. **Agency / managed WOVO** — human help is a purchased tier, never bundled
    into cheap self-service plans. No unlimited human labour.

## Credits and plans

Credits meter real AI work: image, video, music, singing, complex Adam
reasoning, Computer, research, advanced analysis, quality review. Basic
navigation and short help should not consume meaningful credits.

**Free:** 10 one-time credits for a verified user. No card, no forced
subscription, no plan selection at signup.

**Paid direction (simulate, do not hard-code):** Starter ~$14.99, Creator
~$24.99, Pro ~$44.99, Agency much higher. Final allowances come from real
economics — see `lib/portal/pricing-economics.ts` and
`node scripts/pricing-report.mjs`.

**Buy credits:** $10 / $20 / $50 / $100 / $500 / $1,000 / custom $10+, without
subscribing.

**Economics rule:** assume customers use 100% of their credits. Every enabled
model must stay economically safe.

Low credit: show required, current balance, shortage, and options (buy, cheaper
settings, different model, wait for refill). Subscribers see the real next grant
date; pay-as-you-go users must never see a fake refill.

## Auth

Simple signup: create account, Google where working, email/password, 10 free
credits, no card, no plan choice. **Email verification must actually work** —
never show "check your email" if no verification email is really delivered.
Password reset must work end to end. Store terms + privacy version and timestamp
at signup.

Terms must explain that authorized uploaded photos, voice, video, audio,
documents, logos and brand assets may be processed by WOVO and approved
subprocessors to deliver requested services. **Never claim ownership of a
user's face or voice** — limited processing permissions only. Voice and likeness
profiles need separate explicit authorization and must be deletable. Never leak
one workspace's data to another. Do not design around unauthorized celebrity
cloning.

## Design

Premium dark/neutral, restrained WOVO orange, clean typography, large previews,
minimal borders, progressive disclosure, modern sheets/modals, professional SVG
icons, responsive mobile as a first-class experience.

Avoid: generic admin dashboards, old cream pages, excessive cards, debug UI,
emoji navigation.

Use Mobbin as UX research for auth, pricing, composer, model browser, credit
purchase, connections, Computer, projects, assets, mobile and settings. Adapt
patterns; never clone.

## Final hard rules

One customer-facing product. No owner/operations product. No employee portal. No
legacy private workspace. Adam is the main interface. Create supports manual
power users. Computer handles large outcomes. Models sit behind a WOVO
experience but power users may choose them. Internal providers are never
customer-facing. Credits reflect real AI work. Free users get a real product.
Nobody is forced to pay before trying. Successful generations become persistent
assets. Projects, chats and assets share context. Brand Brain makes WOVO
business-aware. Connectors make it capable of real work. Sensitive external
actions require permission. Voice and likeness require explicit authorization.
**Never fabricate provider capabilities or API availability. Never show fake
buttons or fake progress.** Mobile is first-class. Simple for beginners,
powerful for advanced users. Do not recreate old WOVO concepts just because old
code still exists.
