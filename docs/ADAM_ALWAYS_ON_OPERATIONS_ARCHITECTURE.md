# Adam always-on operations architecture

Status: owner-only Phase 2 design and release gate. Do not surface this document as a public or client feature list.

## What is live in Phase 1

Adam's owner dashboard and daily owner report run from WOVO's deployed Vercel and Supabase infrastructure. The daily route is invoked by Vercel Cron and authenticates with `CRON_SECRET`; it does not depend on an open browser, the Codex desktop app, or the owner's computer. A report run reserves a server-side job using a per-workspace, per-local-date idempotency key, stores the report and audit event in Supabase, uses a provider idempotency key for delivery, and creates an owner-visible failure alert when generation or delivery fails.

Phase 1 is deliberately limited. The browser is a control and review surface, not the worker. Automatic client support, onboarding messages, website changes, outreach, publishing, billing actions, calls, and deployments are not enabled.

## Phase 2 durable execution

Adopt a deployed workflow runner, evaluated against the currently installed Vercel Workflow documentation, for work requiring automatic retries, waits, approvals, or multi-step provider calls. Keep orchestration inside `"use workflow"` functions and provider/database operations in bounded `"use step"` functions.

Every run must have:

- a workspace and tenant scope;
- an event type, correlation ID, idempotency key, policy version, and initiating actor;
- explicit inputs with no secrets copied into prompts or audit text;
- bounded attempts, exponential backoff, a next-attempt time, and a dead-letter state;
- an append-only audit trail and owner-visible failure alert;
- a rate limit, cost/credit budget, timeout, and kill switch;
- an approval hook before any external, financial, publishing, deployment, or destructive action;
- a compensating or rollback procedure where an action is reversible.

The scheduler may enqueue due work. It must never bypass the action policy merely because the owner is offline.

## Integration adapter contract

Only adapters that WOVO explicitly supports and verifies may appear in Adam. There is no generic "connect to anything" claim.

Each adapter exposes:

- `connectionStatus`: disconnected, authorization_required, configured, healthy, degraded, revoked;
- `lastVerifiedAt`, safe health evidence, granted scopes, tenant owner, and token expiry;
- supported read and write capabilities as separate permission boundaries;
- a health check that does not perform a customer-visible action;
- token rotation and revocation procedures;
- per-operation rate and spend limits;
- an adapter kill switch plus a global Adam external-action kill switch;
- redacted diagnostics that never display credential values.

OAuth refresh/access tokens are encrypted server-side with a key outside the database, scoped to one tenant and connector, never returned to the browser, and never written to Adam memory, prompts, logs, or email. Server environment credentials remain server-only and are rotated through the provider and Vercel. Revocation immediately disables queued write steps for the connection.

Initial supported-status adapters remain limited to OpenAI, Stripe, Supabase, Vercel, Resend, Meta, GitHub, Calendar, Analytics, and Search Console. A status card is not proof that write capability is enabled. Meta publishing, deployments, billing changes, outbound campaigns, calls, and other write actions remain fail-closed until their individual end-to-end gates pass.

## Opt-in onboarding and inquiry follow-up

Eligible events are limited to verified account creation, verified paid activation or audited owner test access, and deliberate public inquiry submission. Requested onboarding and case follow-up remain on `support@wovomedia.com`. Outreach uses `Adam at WOVO Media <adam@wovomedia.com>` only after sender-domain, unsubscribe, suppression, webhook, reply, rate, spend, and test-delivery gates pass, with an explicit AI disclosure.

Nonessential reminders require suppression and opt-out handling, quiet hours, a rate cap, approved templates, and an owner kill switch. Email contains a case reference and secure portal link rather than sensitive case content. Researched prospects and arbitrary business records are ineligible for this workflow.

## First-line support workflow

Adam may become the first-line responder only after the support workflow passes tenant-isolation, quality, abuse, delivery, and escalation tests. Its retrieval boundary is the verified sender's tenant-authorized workspace, account, support case, and approved WOVO knowledge. Public inquiries remain tenant-neutral until staff links them to an account.

Permitted low-risk help includes onboarding guidance, billing-portal navigation, brand assets, scheduling, common product use, case updates, summaries, and human handoff preparation. Every response must identify Adam as WOVO Media's AI Operations Assistant and distinguish guidance from completed actions.

Mandatory human escalation includes complaints; refunds, disputes, cancellations, or billing changes; legal, privacy, or security requests; account-access problems; safety concerns; deletion requests; consequential actions; and any low-confidence answer. Adam must not change billing, cancel, publish, delete, promise an outcome, or expose another tenant. Server-side reply delivery requires approved templates/policies, rate and abuse controls, audit history, notification rules, confidence thresholds, and an owner kill switch. Until those checks pass, Adam may create support reply drafts only.

## Website improvement loop

Adam may read only permitted aggregate signals: conversion funnel, runtime errors, speed, accessibility, mobile UX, SEO, support themes, approved analytics, and test results. It turns evidence into a proposal containing baseline, hypothesis, expected impact, risk, target metric, affected routes, owner, validation plan, and rollback plan.

Code proposals use an isolated branch and preview. They must pass build, type, lint, security, accessibility, performance, and desktop/mobile browser checks. Pricing, legal text, auth/RLS, analytics/tracking, and customer-facing claims always require explicit owner review. Production deployment remains owner-approved by default. Adam uses WOVO's original coral/ivory/charcoal design system and may not copy third-party screens or assets.

Experiments retain control/variant definitions, baseline and outcome metrics, prompt and software versions, deployment/change links, lessons, and rollback notes. "Learning" means measured workflow, prompt, data, tool, and software improvements; it never claims that the underlying model trained itself.

## Reporting and attribution

The daily owner report may include only recorded values: support volume/resolution and escalations, verified signups, active subscriptions, MRR/ARR estimates derived from stored Stripe subscription records, permitted conversion attribution, content/task state, website health, errors, and metered API/credit use. Missing data is labeled unavailable rather than estimated from unsupported signals.

## Release gates

Before enabling an always-on workflow:

1. Verify the connector's identity, scopes, token encryption, rotation, and revocation.
2. Verify tenant isolation and server-side authorization with negative tests.
3. Verify idempotency, retries, dead-letter handling, alerts, rate limits, and budgets.
4. Verify owner controls, pause/resume, suppression, and kill switches.
5. Verify approval cannot be bypassed after a crash, retry, or token refresh.
6. Verify audit records accurately distinguish drafts, approvals, attempts, and completed external actions.
7. Verify provider behavior end to end in a safe nonfinancial/nonpublishing environment.

No workflow may be described as active until all applicable gates pass in production-oriented testing.
