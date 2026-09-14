import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const hash = async (path) => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

test('isolated pinned official Capacitor project; no paid SDK or inherited web build', async () => {
  const pkg = await json('package.json');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.dependencies, { '@capacitor/core': '8.5.2', '@capacitor/ios': '8.5.2' });
  assert.deepEqual(pkg.devDependencies, { '@capacitor/cli': '8.5.2' });
  const lock = await json('package-lock.json');
  for (const name of ['core', 'ios', 'cli']) assert.equal(lock.packages[`node_modules/@capacitor/${name}`].version, '8.5.2');
  assert.match(await read('ios/App/CapApp-SPM/Package.swift'), /exact: "8\.5\.2"/);
});

test('config restricts internal studio to HTTPS without broad navigation or native plugins', async () => {
  const config = await json('capacitor.config.json');
  assert.equal(config.appId, 'com.wovomedia.wovo');
  assert.equal(config.appName, 'WOVO Internal');
  assert.equal(config.server.url, 'https://wovomedia.com');
  assert.equal(config.server.cleartext, false);
  assert.equal(config.server.errorPath, 'offline.html');
  assert.equal(config.server.allowNavigation, undefined);
  assert.equal(config.loggingBehavior, 'none');
  assert.equal(config.ios.webContentsDebuggingEnabled, false);
  assert.deepEqual(config.includePlugins, []);
  assert.doesNotMatch(await read('ios/App/App/Info.plist'), /NSAllowsArbitraryLoads|NSAllowsLocalNetworking|NSAppTransportSecurity/);
});

test('native delegate is installed and gates exact origin/permissions/links without dropping bridge forwarding', async () => {
  const controller = await read('ios/App/App/WovoBridgeViewController.swift');
  const policy = await read('ios/App/App/WovoNavigationPolicy.swift');
  assert.match(policy, /url\.host\?\.lowercased\(\) == "wovomedia\.com"/);
  assert.match(policy, /url\.user == nil && url\.password == nil/);
  assert.match(policy, /url\.port == nil \|\| url\.port == 443/);
  assert.match(controller, /webView\.navigationDelegate = secureDelegate/);
  assert.match(controller, /webView\.uiDelegate = secureDelegate/);
  assert.match(controller, /override func forwardingTarget/);
  assert.match(controller, /action\.navigationType == \.linkActivated/);
  assert.match(controller, /decisionHandler\(trusted \? \.prompt : \.deny\)/);
  assert.doesNotMatch(controller, /decisionHandler\(\.grant\)|\.useCredential|URLCredential\(trust:/);
  assert.match(controller, /completionHandler\(\.performDefaultHandling, nil\)/);
  assert.match(controller, /http\.statusCode >= 400/);
  assert.match(controller, /NSURLErrorCancelled/);
  assert.match(controller, /mediaTypesRequiringUserActionForPlayback = \.all/);
  assert.match(await read('ios/App/App/SceneDelegate.swift'), /UINavigationController\(rootViewController: WovoBridgeViewController\(\)\)/);
  const pbx = await read('ios/App/App.xcodeproj/project.pbxproj');
  for (const name of ['WovoBridgeViewController', 'WovoNavigationPolicy']) assert.match(pbx, new RegExp(`${name}\\.swift in Sources`));
});

test('fallbacks are bundled, accessible, truthful and have no job/API/network scripts', async () => {
  for (const path of ['www/index.html', 'www/offline.html']) {
    const html = await read(path);
    assert.match(html, /lang="en"/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /Content-Security-Policy/);
    assert.doesNotMatch(html, /<script|iframe|fetch\(|\/api\//i);
    assert.match(html, /href="https:\/\/wovomedia\.com"/);
  }
  assert.match(await read('www/index.html'), /not an App Store release/);
  assert.match(await read('www/offline.html'), /Check your Library before starting it again/);
});

test('real orbit assets retain packaged provenance and app icon is 1024px opaque PNG', async () => {
  const receipt = await json('brand-receipt.json');
  assert.equal(await hash('www/orbit.png'), receipt.webSha256);
  assert.equal(await hash('ios/App/App/Assets.xcassets/WovoOrbit.imageset/orbit.png'), receipt.webSha256);
  const iconPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
  assert.equal(await hash(iconPath), receipt.appIconSha256);
  const icon = await readFile(new URL(iconPath, root));
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon[25], 2, 'PNG RGB without alpha');
  assert.match(await read('ios/App/App/Base.lproj/LaunchScreen.storyboard'), /image="WovoOrbit"/);
  assert.doesNotMatch(await read('ios/App/App/Base.lproj/LaunchScreen.storyboard'), /image="Splash"/);
});

test('build scripts fail closed, run real Swift policy checks, and never upload or provision', async () => {
  for (const path of ['scripts/build-simulator.sh', 'scripts/archive-device.sh']) {
    const body = await read(path);
    assert.match(body, /set -euo pipefail/);
    assert.match(body, /Darwin/);
    assert.match(body, /check-xcode\.mjs/);
    assert.match(body, /npm run verify/);
    assert.match(body, /swiftc ios\/App\/App\/WovoNavigationPolicy.swift/);
    assert.match(body, /navigation-policy-tests.swift/);
    const commands = body.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
    assert.doesNotMatch(commands, /-allowProvisioningUpdates|-upload-app|app-store-connect publish|submit_to_app_store|eas submit|altool/);
  }
  assert.match(await read('scripts/build-simulator.sh'), /CODE_SIGNING_ALLOWED=NO/);
  assert.match(await read('scripts/archive-device.sh'), /CODE_SIGN_STYLE=Manual/);
  assert.match(await read('scripts/archive-device.sh'), /WOVO_APPLE_TEAM_ID:\?/);
  assert.match(await read('scripts/archive-device.sh'), /WOVO_PROFILE_SPECIFIER:\?/);
  assert.match(await read('scripts/archive-device.sh'), /WOVO_EXPORT_OPTIONS_PATH:\?/);
  assert.match(await read('scripts/check-xcode.mjs'), /major < 26/);
  assert.match(await read('ci/github-ios-simulator.yml.example'), /on: workflow_dispatch/);
  assert.match(await read('ci/github-ios-simulator.yml.example'), /runs-on: macos-26/);
});

test('native source contains no checked-in signing material', async () => {
  async function walk(directory) {
    for (const item of await readdir(new URL(directory, root), { withFileTypes: true })) {
      if (['node_modules', 'build', '.git'].includes(item.name)) continue;
      const path = `${directory}${item.name}`;
      if (item.isDirectory()) await walk(`${path}/`);
      else assert.doesNotMatch(item.name, /\.(p8|p12|mobileprovision|cer|key)$|^\.env/i, `Unexpected secret-bearing file: ${path}`);
    }
  }
  await walk('');
});

test('public upload allowlist is native-only, explicit, existing and free of generated/customer/secrets paths', async () => {
  const manifest = await json('public-source-manifest.json');
  assert.equal(new Set(manifest.files).size, manifest.files.length);
  for (const path of manifest.files) {
    assert.ok(path.startsWith('native/') && !path.includes('..') && !path.includes('\\'));
    assert.doesNotMatch(path, /node_modules|\/build\/|\/public\/|\.env|\.(p8|p12|mobileprovision|key)$|customer|verification/i);
    await readFile(new URL(`../${path}`, root));
  }
  assert.equal(manifest.workflow.source, 'native/ci/github-ios-simulator.yml.example');
  assert.equal(manifest.workflow.trigger, 'workflow_dispatch only');
});
