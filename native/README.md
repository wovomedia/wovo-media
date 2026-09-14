# WOVO iOS — internal-test foundation

This directory is isolated from the Next.js website. **No signed IPA, TestFlight
release or App Store submission has been produced or verified.** The first
foundation opens the existing online studio, with native navigation, strict
origin handling and a packaged offline page. It is not Store-ready.

## Local checks (Windows works)

```sh
cd native
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run sync
```

The Xcode project is generated with the official Capacitor CLI, pinned to 8.5.2.
It uses Swift Package Manager and includes a shared `App` scheme. Do not re-run
`cap add ios` over the customized native files. `cap sync ios` is the normal step.
Root verified and registered bundle ID `com.wovomedia.wovo` on2026-09-14 for
Wovo Media LLC, Apple Team `SD667C7LAG`. These are nonsecret identifiers, not
signing credentials. App Store Connect record and signing still need verification.

## Mac build

Xcode 26+ and Node 22+ are required. After dependencies above:

```sh
bash scripts/build-simulator.sh
```

This creates an unsigned simulator `.app`, **not an iPhone-installable IPA**.
The script runs Foundation-only Swift URL-policy tests before compiling UIKit
and WebKit code. A passing Node check alone does not prove Swift compilation.
`ci/github-ios-simulator.yml.example` is a dormant, manual-only workflow template.
It is not an active workflow and does not sign, upload or submit anything.

For an uploadable device archive, an authorized operator must first install a
valid Apple Distribution certificate **with its private key** and the matching
App Store provisioning profile in a secure macOS runner. Provide the verified
nonsecret `WOVO_APPLE_TEAM_ID`, `WOVO_PROFILE_SPECIFIER`, and an absolute
`WOVO_EXPORT_OPTIONS_PATH` pointing to a reviewed file outside this source tree:

```sh
bash scripts/archive-device.sh
```

The script never changes Apple signing settings and never uploads. Review
`ci/ExportOptions.plist.example`; replace placeholders outside the repository.
Upload and TestFlight/App Review actions are separate, authorized steps after
the binary works. Never commit or paste signing keys into chat/source/logs.

## Known limits before inviting testers

- iPhone/iPad compilation, layout, keyboard, sign-in/out, downloads, media picking,
  permission denials and offline retry: **NOT TESTED on a device**.
- Google/social OAuth redirects intentionally cannot navigate the bridged view
  to external domains. A system-auth session and verified callback/session
  handoff are **not implemented**. Do not advertise Google sign-in as verified.
- No native push, native save-to-Photos/share integration or background rendering
  service is implemented. Existing web controls are not evidence of native support.
- The microphone/camera descriptions explain existing web requests. Permission
  decisions prompt only for the top-level exact WOVO origin; other frames are
  denied. Permissions and upload results still require real-device tests.
- `server.url` uses a remote studio. Capacitor documents this configuration for
  live reload rather than production. This is an **internal prototype**, not a
  claim that Apple forbids the setting. A bundled client/production architecture,
  useful native features, security review and Apple 4.2 review readiness remain.
- Existing web billing is unchanged. Links must not be treated as globally
  compliant in an App Store build. A reviewed app-specific purchase boundary is
  required before public submission.
- The app follows the current web backend; it has no bundled server keys,
  independent credit grants or bypass of account authorization.
- Refresh opens the studio with a GET; it does not retry a generation. Unsent
  drafts can be lost. Check Library after a connection failure before spending again.

## Branding

The native icon is the existing large white orbit artwork. The 1024px source
is not resized/redrawn; alpha is flattened on the existing orange for the app
icon. The launch/fallback uses the exact existing 512px PNG. `brand-receipt.json`
records hashes; `scripts/prepare-brand.mjs` is a one-time canonical-source
packaging helper, not required in a standalone native-source CI checkout.

## Source handling

The existing GitHub repository is public and its default branch is stale.
Do not upload the web repository, environment files, generated media, customer
data or verification artifacts. Any native-only upload still needs the owner's
specific approval because it publishes source. Exclude node_modules, build,
ignored generated public copies and all signing material. For a standalone
native-only repository, adjust the dormant workflow's `native/` paths to `.`.
`public-source-manifest.json` is the exact reviewed file allowlist; its optional
workflow destination is separate from the native source files. User approval
was relayed by root on2026-09-14; do not expand it to web source or other files.

See `docs/native-build-2026-09-14.md` in the canonical repository for the release
evidence and remaining account/signing/review blockers.
