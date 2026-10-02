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
  assert.match(bridge, /private func mayDownload[\s\S]*?guard action\.navigationType == \.linkActivated, let url = action\.request\.url else \{ return false \}/);
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
  assert.match(coordinator, /matchesHeader\(try handle\.read\(upToCount: 24\)/);
  assert.match(coordinator, /let byteLimit = expectedBytes > 0 \? min\(routeLimit, expectedBytes\) : routeLimit/);
  assert.match(coordinator, /UIActivityViewController\(activityItems: \[file\], applicationActivities: nil\)/);
  assert.match(coordinator, /completionWithItemsHandler[\s\S]*?stop\(showError: false, for: identifier\)/);
  assert.match(coordinator, /popoverPresentationController\?\.sourceView/);
  assert.match(coordinator, /popoverPresentationController\?\.sourceRect/);
  assert.match(coordinator, /active\.cancel \{ _ in Self\.remove\(folder\) \}/);
  assert.match(coordinator, /deletingLastPathComponent\(\)\.standardizedFileURL == FileManager\.default\.temporaryDirectory\.standardizedFileURL/);
  assert.match(coordinator, /UUID\(uuidString: String\(folder\.lastPathComponent\.dropFirst/);
  assert.doesNotMatch(coordinator, /print\(|NSLog|error\.localizedDescription|resumeData\s*=|writeToSavedPhotosAlbum|PHPhotoLibrary/);
});

test('download policy is wired into the Mac compile and test commands without new dependencies', () => {
  const script = read('scripts/build-simulator.sh');
  assert.match(script, /swiftc ios\/App\/App\/WovoNavigationPolicy\.swift ios\/App\/App\/WovoDownloadPolicy\.swift tests\/download-policy-tests\.swift/);
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  for (const name of ['WovoDownloadPolicy', 'WovoDownloadCoordinator']) {
    assert.match(project, new RegExp(`${name}\\.swift in Sources`));
    assert.ok(JSON.parse(read('public-source-manifest.json')).files.includes(`native/ios/App/App/${name}.swift`));
  }
});

test('current private artifacts retain a narrow endpoint, query, MIME and size boundary', () => {
  assert.match(policy, /path\[2\] == "generations"[\s\S]*?path\[4\] == "artifact"[\s\S]*?isArtifactJobId/);
  assert.match(policy, /items\.count == 1[\s\S]*?items\[0\]\.name == "organizationId"/);
  assert.match(policy, /components\.percentEncodedQuery == "organizationId=\\\(organizationId\)"/);
  assert.match(policy, /\[1-8\]\[0-9a-f\]\{3\}-\[89ab\]/);
  assert.match(policy, /\(1\.\.\.128\)\.contains\(value\.utf8\.count\)/);
  assert.match(policy, /maximumArtifactBytes: Int64 = 20 \* 1024 \* 1024/);
  assert.match(policy, /maximumTextBytes: Int64 = 800_000/);
  assert.match(policy, /case \("artifact", "image\/png"\) where length <= maximumArtifactBytes: return \.png/);
  assert.match(policy, /case \("artifact", "video\/mp4"\) where length <= maximumArtifactBytes: return \.mp4/);
  assert.match(policy, /length <= maximumTextBytes \? \.txt : nil/);
  assert.match(policy, /case \.png:[^\n]*\[137, 80, 78, 71, 13, 10, 26, 10\]/);
  assert.match(policy, /case \.txt: return matchesText\(bytes\)/);
  const swiftTests = read('tests/download-policy-tests.swift');
  assert.match(swiftTests, /artifactInvalid[\s\S]*?%6frganizationId[\s\S]*?signature=[\s\S]*?blob:/);
  assert.match(swiftTests, /maximumArtifactBytes \+ 1/);
  assert.match(swiftTests, /maximumTextBytes \+ 1/);
  assert.match(swiftTests, /0xed,0xa0,0x80/);
  assert.doesNotMatch(policy, /httpCookieStore|URLSession|URLRequest|evaluateJavaScript/);
});

test('current artifacts validate full MIME, approved MP4 bytes and the complete bounded text file', () => {
  assert.match(coordinator, /kind\(for: request\) == "artifact"[\s\S]*?http\.value\(forHTTPHeaderField: "Content-Type"\) : response\.mimeType/);
  assert.match(policy, /case \("artifact", "text\/plain;charset=utf-8"\)/);
  assert.doesNotMatch(policy, /case \("artifact", "text\/plain"\)/);
  assert.match(policy, /prefix\.count >= 24[\s\S]*?\["isom", "iso2", "mp41", "mp42", "avc1", "M4V "\]/);
  assert.match(policy, /boxSize >= 16 && Int64\(boxSize\) <= length/);
  assert.match(coordinator, /if format == \.txt[\s\S]*?read\(upToCount: Int\(WovoDownloadPolicy\.maximumTextBytes\) \+ 1\)[\s\S]*?Int64\(bytes\.count\) == expectedBytes, WovoDownloadPolicy\.matchesText\(bytes\)/);
  assert.match(policy, /String\(data: bytes, encoding: \.utf8\)/);
  assert.match(policy, /text\.unicodeScalars\.allSatisfy/);
  assert.doesNotMatch(coordinator, /supports WOVO video and audio files up to 256 MB/);
});
