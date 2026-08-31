# WOVO social publishing integration checklist

Do not treat an access token or a successful OAuth redirect as publishing proof. A production connection is **Publishing ready** only after provider verification succeeds. A delivery is **Published** only when the provider returns durable post/video proof and WOVO saves it.

## Test evidence to retain

For every canary, retain only non-secret evidence:

- WOVO workspace ID and connection ID
- provider/account label (not tokens)
- exact test scenario
- WOVO job ID and idempotency key
- provider publish/post ID
- timestamps and final state
- sanitized provider error code for failures

Never record tokens, raw authorization codes, provider secrets, full private captions, or customer media URLs in test logs.

## Facebook Page test

- [ ] Connect Facebook through official OAuth
- [ ] Callback consumes the state once
- [ ] Authorized Pages are listed
- [ ] More than one selected/authorized Page is saved independently
- [ ] Selected Page is visible on Connections
- [ ] Token debug says valid and app ID matches WOVO
- [ ] `pages_manage_posts` is present
- [ ] Text-only test post returns a Facebook post ID
- [ ] Image post returns a Facebook photo/post ID
- [ ] MP4 Page Reel completes start → `rupload.facebook.com` → finish/PUBLISHED
- [ ] WOVO saves the provider ID before showing Published
- [ ] Missing permission produces Action required and no Published state
- [ ] Expired token produces Action required
- [ ] Disconnect blocks queued provider actions
- [ ] Reconnect creates a verified usable connection

## Instagram professional-account test

- [ ] Connect through the selected Facebook Page
- [ ] Discover the Page-linked Instagram professional account
- [ ] Save the Instagram account ID/username separately in the normalized catalog
- [ ] Verify `instagram_basic` and `instagram_content_publish`
- [ ] Image container reaches FINISHED
- [ ] `media_publish` returns a media ID
- [ ] Reel container reaches FINISHED
- [ ] Reel `media_publish` returns a media ID
- [ ] WOVO saves the provider media ID before showing Published
- [ ] Missing professional account gives Action required
- [ ] Missing scope gives Action required
- [ ] Expired authorization gives Action required
- [ ] Container ERROR/EXPIRED/TIMEOUT gives Failed and no provider proof
- [ ] Reconnect restores verification

## TikTok Direct Post test

- [ ] OAuth state is single-use and workspace-bound
- [ ] `user.info.basic` and `video.publish` are granted
- [ ] Creator info is queried immediately before export
- [ ] UI privacy choices come only from `privacy_level_options`
- [ ] disabled comment/Duet/Stitch capabilities cannot be enabled
- [ ] media URL is HTTPS and WOVO-controlled
- [ ] unaudited test is forced to SELF_ONLY
- [ ] `publish_id` is saved as Processing, not Published
- [ ] status polling reaches PUBLISH_COMPLETE or FAILED
- [ ] provider post ID is saved only after completion
- [ ] revoked/expired auth stops processing and requests reconnect
- [ ] public visibility is tested only after TikTok audit approval

## YouTube/Shorts test

- [ ] OAuth state is single-use and workspace-bound
- [ ] upload-only scope is granted
- [ ] offline refresh token is returned and encrypted
- [ ] connected channel ID/name is displayed
- [ ] resumable upload session starts
- [ ] MP4 upload returns a YouTube video ID
- [ ] private upload appears in YouTube Studio
- [ ] WOVO polls upload/processing status
- [ ] WOVO saves video ID as provider proof
- [ ] expired access token refreshes server-side
- [ ] missing refresh token requires reconnect
- [ ] public upload is rejected until API audit approval
- [ ] public Short canary runs only after Google verification/audit

## Required distinction in release reports

### Implementation works

Use only after the local UI → route → database transitions and provider request contracts have passed automated tests.

### Production third-party approval still required

Use whenever a provider audit, OAuth review, permission review, verified media domain, or production credential remains incomplete. Never collapse these two statements into “publishing works.”
