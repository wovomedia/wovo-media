# Official Meta publishing — feature-gated next phase

Status: scaffold only. WOVO does not currently connect, publish, boost, or distribute content through Meta.

The launch workflow remains human-in-the-loop: AI-assisted drafts and calendar entries can be prepared, clients approve them, and WOVO receives a durable manual-posting task. No browser automation, scraping, password collection, or credential sharing is permitted.

## Code routes

- Start connection: `POST /api/integrations/meta/connect` (authenticated, tenant-scoped)
- OAuth callback: `GET /api/integrations/meta/callback`
- Revoke connection: `POST /api/integrations/meta/revoke` (authenticated, tenant-scoped)
- Production OAuth redirect URL: `https://wovomedia.com/api/integrations/meta/callback`

All routes fail closed while the integration is a scaffold. Turning on `WOVO_META_PUBLISHING_ENABLED` still does not enable OAuth; the callback deliberately returns `501` until the reviewed implementation is complete.

## Current permission names verified from Meta documentation

Choose one reviewed login model rather than mixing permissions without need.

Instagram Login:

- `instagram_business_basic`
- `instagram_business_content_publish`

Facebook Login for Business/Page discovery and publishing:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `instagram_basic`
- `instagram_content_publish`

Permission scope must be minimized to the exact WOVO workflow and submitted for Meta App Review where required. Sources checked July 30, 2026: [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/) and [Meta permissions reference](https://developers.facebook.com/docs/permissions/).

## Required secure implementation

1. Create tenant-scoped connection rows keyed by WOVO workspace and authenticated member—not an email string.
2. Generate a cryptographically random OAuth state, bind it to the user, workspace, nonce, expiry, and exact redirect URI, and validate it once.
3. Exchange authorization codes only on the server.
4. Encrypt access and refresh/long-lived tokens with an application encryption key kept outside Supabase public schemas and outside client bundles. Store key version and token expiry; never log token material.
5. Record the selected Facebook Page / Instagram professional account IDs only after the user confirms they control those business assets.
6. Provide visible connection state, scopes, last validation, expiry, reconnect, and revocation controls. Revocation must delete or render unusable local token material and call the appropriate Meta revocation endpoint.
7. Create immutable publish-job attempts and status logs. Jobs remain tenant-scoped and idempotent.
8. Require a specific approved WOVO content item, final caption/assets, destination, scheduled time, and explicit client confirmation before any automatic publish job is eligible.
9. Run jobs through a durable background provider with retries, rate-limit handling, failure notifications, and a staff override. Vercel request handlers alone are not a sufficient job queue.
10. Keep assets permissioned and private. Never reuse listing, likeness, voice, or customer media without recorded rights/consent.

Expected server configuration:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_TOKEN_ENCRYPTION_KEY` (versioned, strong random key; define rotation procedure)
- `WOVO_PUBLISH_JOB_PROVIDER`
- `WOVO_META_PUBLISHING_ENABLED=false` until review and end-to-end production testing

## Meta dashboard setup checklist

1. Create or select the WOVO business app in Meta for Developers.
2. Add the appropriate Instagram API / Facebook Login for Business products.
3. Register `https://wovomedia.com/api/integrations/meta/callback` as an exact valid OAuth redirect URI.
4. Add WOVO’s verified domain and required privacy policy, terms, data-deletion, and support URLs.
5. Request only the selected permission set and complete Business Verification / App Review where Meta requires it.
6. Configure test users and test business assets that contain no real customer content.
7. Keep the app in development mode until connection, tenant isolation, revocation, token encryption, expiry, publishing approval, retry behavior, and audit logs pass.
8. Complete a limited production test with owner-controlled assets before enabling any customer.

“Boosting” is not organic publishing. Paid ads require an explicit advertising authorization, approved budget, destination, audience, billing responsibility, and additional Meta Marketing API permissions/review. Group distribution must follow platform and group rules and must not be automated spam.

Outreach is also separate from Meta publishing. WOVO must not send unsolicited bulk email unless the owner approves the audience and message and legal/compliance checks, suppression lists, unsubscribe handling, and sender reputation controls are in place.
