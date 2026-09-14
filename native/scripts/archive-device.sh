#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then echo 'A macOS runner is required.' >&2; exit 1; fi
: "${WOVO_APPLE_TEAM_ID:?Set the verified Apple Team ID in the runner environment.}"
: "${WOVO_PROFILE_SPECIFIER:?Set the name of the already installed App Store distribution profile.}"
: "${WOVO_EXPORT_OPTIONS_PATH:?Set an absolute path to reviewed export-options.plist outside the source tree.}"
[[ "$WOVO_APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo 'Invalid Apple Team ID.' >&2; exit 1; }
[[ "$WOVO_EXPORT_OPTIONS_PATH" = /* && -f "$WOVO_EXPORT_OPTIONS_PATH" ]] || { echo 'A reviewed absolute export-options path is required.' >&2; exit 1; }
node scripts/check-xcode.mjs
npm run verify
npm run sync
mkdir -p build/policy
swiftc ios/App/App/WovoNavigationPolicy.swift tests/navigation-policy-tests.swift -o build/policy/navigation-tests
build/policy/navigation-tests
swiftc ios/App/App/WovoNavigationPolicy.swift ios/App/App/WovoDownloadPolicy.swift tests/download-policy-tests.swift -o build/policy/download-tests
build/policy/download-tests
# Deliberately no -allowProvisioningUpdates: cannot create/alter Apple credentials.
# An authorized operator must install the certificate/private key and matching profile.
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/WOVO-Internal.xcarchive \
  DEVELOPMENT_TEAM="$WOVO_APPLE_TEAM_ID" CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$WOVO_PROFILE_SPECIFIER" archive
xcodebuild -exportArchive -archivePath build/WOVO-Internal.xcarchive \
  -exportPath build/device -exportOptionsPlist "$WOVO_EXPORT_OPTIONS_PATH"
echo 'Archive/export completed. No upload, TestFlight invitation or App Store submission was performed.'
