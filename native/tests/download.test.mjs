import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bridge = read('ios/App/App/WovoBridgeViewController.swift');
const coordinator = read('ios/App/App/WovoDownloadCoordinator.swift');
const policy = read('ios/App/App/WovoDownloadPolicy.swift');

test('native download is an explicit trusted-frame GET, not a script or response bridge', () => {
  assert.match(bridge, /action\.shouldPerformDownload[\s\S]*?mayDownload\(action, in: webView\) && downloads\.begin\(action\)/);
  assert.match(bridge, /explicitLink: action\.navigationType == \.linkActivated/);
  assert.match(bridge, /mainSource: action\.sourceFrame\.isMainFrame/);
  assert.match(bridge, /navigationResponse response:[\s\S]*?download\.cancel\(nil\)/);
  assert.match(policy, /explicitLink && downloadAttribute && mainSource && mainTarget && method == "GET"/);
  assert.match(coordinator, /approvedAction === action[\s\S]*?download\.originalRequest\?\.url == request/);
  assert.match(coordinator, /download\.isUserInitiated, download\.originatingFrame\.isMainFrame/);
  assert.doesNotMatch(coordinator, /URLSession\s*\(|\.dataTask\(|\.downloadTask\(|evaluateJavaScript|WKScriptMessageHandler|httpCookieStore|resumeDownload/);
});

test('download is bounded, foreground-only, cleans up, and shares only the finished file', () => {
  assert.match(policy, /maximumBytes: Int64 = 256 \* 1024 \* 1024/);
  assert.match(policy, /maximumSeconds: TimeInterval = 60/);
  assert.match(policy, /response == request, status == 200, length > 0, length <= maximumBytes/);
  assert.match(coordinator, /progress\.completedUnitCount/);
  assert.match(coordinator, /willPerformHTTPRedirection[\s\S]*?decisionHandler\(\.cancel\)/);
  assert.match(coordinator, /didEnterBackgroundNotification/);
  assert.match(coordinator, /if !sharing \{ stop\(showError: false\) \}/);
  assert.match(coordinator, /request == nil/);
  assert.match(coordinator, /guard attempt == identifier else \{ return \}/);
  assert.match(coordinator, /attempt != identifier \{ return \}/);
  assert.match(coordinator, /Int64\(count\) == expectedBytes/);
  assert.match(coordinator, /matchesHeader\(try handle\.read\(upToCount: 16\)/);
  assert.match(coordinator, /UIActivityViewController\(activityItems: \[file\], applicationActivities: nil\)/);
  assert.match(coordinator, /completionWithItemsHandler[\s\S]*?stop\(showError: false, for: identifier\)/);
  assert.match(coordinator, /popoverPresentationController\?\.sourceView/);
  assert.match(coordinator, /popoverPresentationController\?\.sourceRect/);
  assert.match(coordinator, /active\.cancel \{ _ in Self\.remove\(folder\) \}/);
  assert.match(coordinator, /deletingLastPathComponent\(\)\.standardizedFileURL == FileManager\.default\.temporaryDirectory\.standardizedFileURL/);
  assert.match(coordinator, /UUID\(uuidString: String\(folder\.lastPathComponent\.dropFirst/);
  assert.doesNotMatch(coordinator, /print\(|NSLog|error\.localizedDescription|resumeData\s*=|writeToSavedPhotosAlbum|PHPhotoLibrary/);
});

test('download policy is compiled and tested on Mac and bundled without new dependencies', () => {
  const script = read('scripts/build-simulator.sh');
  assert.match(script, /swiftc ios\/App\/App\/WovoNavigationPolicy\.swift ios\/App\/App\/WovoDownloadPolicy\.swift tests\/download-policy-tests\.swift/);
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  for (const name of ['WovoDownloadPolicy', 'WovoDownloadCoordinator']) {
    assert.match(project, new RegExp(`${name}\\.swift in Sources`));
    assert.ok(JSON.parse(read('public-source-manifest.json')).files.includes(`native/ios/App/App/${name}.swift`));
  }
});
