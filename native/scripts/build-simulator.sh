#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo 'iOS compilation requires a Mac or approved macOS cloud runner.' >&2
  exit 1
fi
xcodebuild -version
node scripts/check-xcode.mjs
npm run verify
npm run sync
mkdir -p build/policy
swiftc ios/App/App/WovoNavigationPolicy.swift tests/navigation-policy-tests.swift -o build/policy/navigation-tests
build/policy/navigation-tests
swiftc ios/App/App/WovoNavigationPolicy.swift ios/App/App/WovoDownloadPolicy.swift tests/download-policy-tests.swift -o build/policy/download-tests
build/policy/download-tests
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/simulator CODE_SIGNING_ALLOWED=NO build
test -d build/simulator/Build/Products/Debug-iphonesimulator/App.app
echo 'Unsigned simulator app ready. This is NOT an iPhone-installable IPA or TestFlight upload.'
