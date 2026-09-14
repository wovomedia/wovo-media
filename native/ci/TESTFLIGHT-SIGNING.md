# Dormant signed-device / TestFlight path

## Local validation1 activation candidate

The owner has now approved encrypted GitHub signing-secret transfer and root
reports the Distribution certificate/profile verified. This task did **not**
perform that transfer or access the credentials. `github-ios-testflight.yml` and
`testflight-request.json` are prepared locally and included in the native source
manifest; the workflow maps to `.github/workflows/wovo-ios-testflight.yml` on the
native-only branch. Root must still review/push the exact payload and configure
the protected environment and repository gates. No remote activation occurred here.

This initial candidate is fixed in source to **version 1.0, build 1,
`validate-only`**, request label `validation1`. It has no upload acknowledgement,
so changing environment variables cannot turn it into an upload. After verified
validation, a separate reviewed workflow/request/SHA change is required for upload.
The two `.example` workflows below remain reference templates, not extra mappings.

Prepared September 14, 2026. **Not remotely activated by this task and not
signing-tested on macOS.** An App Store Connect API key does not replace an Apple
Distribution certificate and its private key. Root's credential verification is
separate from this runner's still-unverified first signing execution. No script creates,
revokes or downloads signing credentials, invites testers or submits App Review.

## Exact owner inputs

Configure the `ios-internal-signing` GitHub environment **only after explicit
approval to transfer each secret to GitHub**. Never put them in source, an issue,
chat, workflow input, artifact, or the public native upload manifest.

| Protected environment secret | Required value |
| --- | --- |
| `WOVO_P12_BASE64` | Base64 of an already exported, password-encrypted Apple Distribution `.p12`, including the certificate **and matching private key**. A downloaded `.cer` or CSR alone is insufficient. |
| `WOVO_P12_PASSWORD` | Password protecting that `.p12`. |
| `WOVO_PROFILE_BASE64` | Base64 of an unexpired **App Store** `.mobileprovision` for the verified team and exact `com.wovomedia.wovo` bundle, containing the distribution certificate. Not development, ad-hoc, wildcard or enterprise. |
| `WOVO_ASC_P8_BASE64` | Base64 of the owner-downloaded team App Store Connect `.p8` key. The script renames its temporary copy to `AuthKey_<KeyID>.p8`; it does not infer the key ID from a filename such as `AppManager.p8`. |

Base64 is encoding, not encryption. The `.p12` password and GitHub's encrypted
secret storage are separate controls. Keep the owner's original files in their
protected vault. Each GitHub secret must fit the platform's size limit; do not
commit an oversized secret as a workaround. [GitHub Apple-signing setup](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications),
[Apple certificate export guidance](https://help.apple.com/xcode/mac/current/en.lproj/dev154b28f09.html).

Non-secret environment variables:

- `WOVO_APPLE_TEAM_ID`: verified ten-character team ID.
- `WOVO_ASC_KEY_ID`, `WOVO_ASC_ISSUER_ID`: the exact team API key ID and issuer UUID from App Store Connect. This template does not support individual API keys.
- For the push option: `WOVO_APP_VERSION` (for example `1.0`), a new unused `WOVO_BUILD_NUMBER` (`1`–`9999`), `WOVO_RELEASE_OPERATION` (`validate-only` first), `WOVO_RELEASE_ACK=BUILD_REVIEWED_NATIVE_SOURCE`; set `WOVO_UPLOAD_ACK=UPLOAD_BUILD_ONLY` only for the separately approved `upload-to-testflight` operation.

Repository variables used **before the environment job starts**:

- `WOVO_IOS_SIGNING_ENABLED`: leave absent/`false` until the owner approves this exact run.
- Push option only: `WOVO_REVIEWED_SHA`, the full, reviewed commit SHA. This must equal the pushed commit, not a branch name or earlier source revision.

Protect the environment to the `wovo-ios-build` branch, require the owner/reviewer
where the GitHub plan supports it, prevent bypass where feasible, and protect
that branch/workflow against unreviewed changes. Some environment protection
features depend on repository visibility and plan: verify them rather than
assuming the YAML creates an approval gate. [GitHub environment controls](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## Trigger without touching the live website's branch

The existing `main` branch is linked to Vercel. **Do not push these files to main,
change the default branch, or change Vercel's production branch to enable CI.**
Preserve the native-only branch's root `vercel.json` with Git deployments disabled.

`github-ios-testflight.yml.example` is a manual-dispatch template, not an active
workflow. GitHub requires the workflow to exist on the default branch for manual
dispatch; installing it only on `wovo-ios-build` does not remove that restriction.
It is therefore not the present fast path. [GitHub manual workflow requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The alternative `github-ios-testflight-push.yml.example` can be deliberately
mapped to `.github/workflows/wovo-ios-testflight.yml` **on the native-only branch**:

1. Keep signing disabled. Prepare the full reviewed native-only commit locally,
   including this workflow and a changed `native/ci/testflight-request.json`.
   That trigger file contains only a non-secret request label (for example
   `{"request":"owner-approved-validation-1"}`); it is never parsed as commands.
   The current local candidate supplies `validation1` with matching version/build
   and validate-only metadata; future requests need a new reviewed change.
2. Verify the commit contains only the approved native allowlist, workflow and
   no-deploy guard. Record its exact SHA **before** pushing it.
3. After approval for secrets, runner cost and that source, configure the protected
   inputs, the matching repository `WOVO_REVIEWED_SHA`, and enable flag. Push only
   this reviewed commit to `wovo-ios-build`; do not rewrite remote history.
4. Approve the protected environment job if supported. Other branches, other paths
   and different SHAs cannot enter this signing job. Restore the enable flag to
   `false` after the attempt, including failure. A skipped job is not a successful build.
5. For a later upload, explicitly approve a **new** request commit and its SHA plus
   `upload-to-testflight` and `UPLOAD_BUILD_ONLY`. First check whether a prior upload
   already arrived. Never blindly rerun an uncertain upload or reuse its build number.

The initial dormant implementation had no activation mapping. The local
`validation1` candidate now maps only the fixed validation workflow; templates
remain unmapped. Publishing that candidate can run validation only when its exact
SHA, enable flag, protected credentials and approvals are configured. Actions use immutable commits,
read-only repository permission, no persisted checkout credentials, and no secret
artifact step. [GitHub action pinning guidance](https://docs.github.com/en/actions/reference/security/secure-use).

## What the script does

`node scripts/testflight-release.mjs` rejects local/self-hosted runners, unapproved
events, wrong repository/branch/SHA, debug logging, invalid version/build and
missing protected inputs before materializing credentials. It verifies Xcode/iOS
SDK 26+, the checked-out SHA, native Node tests and both Swift policy suites.

It checks the profile's exact team/bundle/type/expiry and matches its certificate
fingerprint to a valid imported Apple Distribution identity. It uses a fresh
passworded temporary keychain, restricts imported-key tool access, preserves the
previous search list and never overwrites a different existing profile. Both
current and legacy Xcode profile directories receive only the same verified profile.

The archive is manually signed with the reviewed version/build and fingerprint,
then its bundle/version/signature are checked. Export uses ordinary
`app-store-connect`, `destination=export`, manual signing, and no automatic version
change or provisioning. Thus an uploaded build can later be considered for public
review; this script does **not** submit it. The `.p8` is written only after export.

Apple Transporter verifies the IPA before optional upload, with key/issuer
authentication from a private temporary working directory. No raw credentials,
tool logs or IPA are published as artifacts; a safe receipt prints source/IPA
hashes, version/build and command outcome. Transporter success is **not** processing
completion, TestFlight availability or App Review approval. [Apple Transporter guide](https://help.apple.com/itc/transporteruserguide/en.lproj/static.html),
[Apple build upload lifecycle](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

Normal completion, command failure and handled interruption restore the keychain
search list and remove the temporary keychain, newly installed unchanged profile
files, keys and IPA/archive. Changed/pre-existing profiles are not deleted.
Cleanup failure fails the run. A hard kill/host failure still relies on destruction
of the fresh GitHub-hosted runner; this script intentionally refuses self-hosted
machines. Do not retain or publish runner disks or signing directories.

## Verification and limits

The Node tests use synthetic credentials and mocked macOS/Apple commands to check
authorization gates, profile rejection, exact certificate matching, operation
order, failure cleanup, and no upload after a failed build/validation. They do not
prove a real certificate is accepted, Transporter is installed, signing succeeds
or an iPhone can install the app. Run the first authorized job in `validate-only`
and inspect the result before granting upload permission. A failure prints only
the stage; investigate privately rather than turning on public debug logging.

The separate iOS submission-readiness document remains applicable: native login,
billing, deletion, privacy and device QA gates are not solved by signing a binary.
