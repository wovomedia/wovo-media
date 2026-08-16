# Adam mail and outreach activation

Adam Carter is WOVO Media's AI COO / Operations Assistant. It must never be represented as Payton or as a human employee. `support@wovomedia.com` remains the public support and transactional identity. Outreach is sent only as `Adam at WOVO Media <adam@wovomedia.com>`.

## Compromised-password rule

Never paste, store, log, or use a Gmail password. If one was disclosed, change it in Google immediately, sign out other sessions, review recent security activity, and enable two-step verification. WOVO mailbox access is OAuth-only.

## Resend activation gate

1. Verify `wovomedia.com` in Resend. This confirms SPF and DKIM; separately publish and confirm a DMARC record.
2. Replace the invalid/revoked server API key in Vercel as `RESEND_API_KEY` for Production and Preview as appropriate.
3. Add a Resend webhook for `https://wovomedia.com/api/webhooks/resend` and select delivered, delayed, failed, bounced, complained, and received events. Store its signing secret in Vercel as `RESEND_WEBHOOK_SECRET`.
4. Add a random 32-byte hex server secret as `WOVO_OUTREACH_UNSUBSCRIBE_SECRET`.
5. Set `WOVO_ADAM_OUTREACH_SENDER=adam@wovomedia.com`. Keep `WOVO_OUTREACH_ENABLED=false` until the test gate passes.
6. Confirm a test delivery, signed webhook receipt, one-click unsubscribe, permanent-bounce suppression, complaint suppression, and reply detection. Only then record the corresponding verification timestamps on the reviewed campaign and lift its kill switch.
7. Begin at five messages per day or less. The database caps a campaign at 25/day and keeps a separate daily spend cap. Increasing either requires owner review and deliverability evidence.

## Optional Google mailbox OAuth

Create a Google OAuth 2.0 web application and authorize the exact `adam@wovomedia.com` account. Use redirect URI `https://wovomedia.com/api/integrations/google-mail/callback`. Server-only variable names are `GOOGLE_WORKSPACE_CLIENT_ID`, `GOOGLE_WORKSPACE_CLIENT_SECRET`, and `GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY` (32-byte hex). Request only OpenID identity scopes plus `https://www.googleapis.com/auth/gmail.send`; do not request mailbox read access. Store the refresh token encrypted, support revocation, and retain a sent-message audit. The callback is not exposed until the full OAuth implementation and revocation test pass.

## Public-web lead research

Use public search results and public company pages only. Respect site terms and robots, fetch conservatively, cache results, and retain the source URL and retrieval date. Do not use login-gated data, restricted-site scraping, data brokers, private/personal emails, or sensitive-trait inference. Research produces a private owner review list; it never bypasses the campaign send gate.
