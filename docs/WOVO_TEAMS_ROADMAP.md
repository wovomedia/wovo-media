# WOVO Teams — post-launch, feature-gated roadmap

This product is not active in the launch build. It must remain behind a disabled feature flag until seat billing, invitation verification, tenant-isolation tests, and owner controls pass a separate release review.

## Business employee seats

- Core workspace owner invites employees into only that paying business's tenant.
- Proposed billing is $2.99/month per active employee seat, separate from the main workspace subscription.
- Employee roles are client-organization roles, never WOVO staff roles.
- Owner-managed permissions should be capability-based: view, draft, approve, and schedule.
- Invitations must use verified email, an expiring single-use token, tenant binding, and an explicit acceptance step.
- Seat activation, suspension, removal, role changes, and billing-impacting changes need audit history and idempotent Stripe handling.
- Removing or suspending a seat must revoke its organization access promptly without deleting business-owned work.

## Tenant-scoped organization chat

- Business owners and their invited seats can use private workspace chat without requiring Slack.
- Organization chat is a separate domain from WOVO support cases and WOVO's internal team operations.
- Every channel, membership, message, attachment, and read grant must carry the tenant account ID and enforce RLS.
- Membership removal revokes future access; sensitive exports and retained history require a documented policy.
- No public, guessable, or cross-tenant conversation links.

## Private client assistant

- The assistant may explain the workspace and prepare explicitly requested, low-risk portal changes.
- External publishing, purchases, billing changes, bookings, destructive actions, and other consequential changes always require clear confirmation and an auditable server-side authorization step.
- Chat remains private by default. Sharing uses explicit recipient grants, non-guessable references, revocation, expiry where appropriate, and an access log.
- The assistant cannot silently broaden permissions, invite users, or expose WOVO support/internal conversations.

## Release gate

Before activation, verify invitation abuse controls, email delivery, tenant RLS, role escalation resistance, seat-count reconciliation, proration/cancellation behavior, chat revocation, attachment isolation, audit history, and recovery/admin repair paths.
