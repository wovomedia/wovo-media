# Adam opt-in onboarding automation

Status: owner-only implementation design. This is not a live client feature and must not be displayed on public or standard client-facing surfaces until the complete workflow is implemented and verified.

## Purpose

Adam may help people who deliberately create a WOVO account or submit a WOVO inquiry. The workflow is limited to welcome and setup guidance, activation reminders, and support-case follow-up. It is separate from prospect research and campaign outreach.

## Eligible triggers

- A newly created account has completed email verification.
- A verified account has completed a paid activation event, or has an audited owner test grant.
- A visitor has deliberately submitted the public WOVO inquiry form.

An arbitrary researched business, scraped record, purchased list, or unverified address is never an eligible trigger.

## Safe delivery rules

- Send requested onboarding/support messages through `support@wovomedia.com`. Outreach uses `Adam at WOVO Media <adam@wovomedia.com>` only after sender-domain alignment and delivery controls pass; every outreach message identifies Adam Carter as WOVO's AI COO / Operations Assistant.
- Clearly identify Adam as WOVO Media's AI Operations Assistant.
- Transactional messages explain why the recipient is receiving them and link to the relevant WOVO setup or support flow.
- Do not put sensitive support-message content in email. Use the case reference and a secure portal destination.
- Nonessential reminders honor suppression, opt-out, owner-configured rate limits, quiet hours, and a maximum attempt count.
- Never send cold or bulk outreach from this workflow.

## Durable workflow

Each event receives an idempotency key and becomes a durable job with a correlation ID. The owner can see:

- `queued`
- `waiting_approval`
- `sent`
- `failed`
- `suppressed`
- `cancelled`

Retries use bounded backoff. Repeated failures move to a visible dead-letter state. Templates, delivery attempts, actor, approval, timestamps, provider message ID, and suppression reason are audited without storing secrets.

## Owner controls

- Enable or disable each automation category independently.
- Review and approve the active template and sender identity.
- Configure reminder timing, quiet hours, attempt limits, and rate caps.
- Pause or cancel pending work.
- Inspect delivery status and failure alerts.

External outreach campaigns remain a separate approval-gated system. Adam may research and draft compliant outreach, but no campaign sends until the owner approves the audience, message, sender, rate, opt-out language, and compliance policy.

## Release gate

Do not expose or enable this workflow until database policies, job idempotency, email verification, suppression behavior, sender authentication, templates, owner controls, retries, failure alerts, and end-to-end delivery have all passed production-oriented tests.
