import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('active simulator workflow is restricted to the authorized repository and isolated branch', async () => {
  const body = await read('ci/github-ios-build.yml');
  assert.match(body, /on:\n  push:\n    branches: \[wovo-ios-build\]\n  workflow_dispatch:/);
  assert.match(body, /if: github\.repository == 'wovomedia\/wovo-media' && github\.ref == 'refs\/heads\/wovo-ios-build' && \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\)/);
  assert.match(body, /permissions:\n  contents: read/);
  assert.match(body, /runs-on: macos-26/);
  assert.match(body, /timeout-minutes: 25/);
  assert.match(body, /persist-credentials: false/);
  assert.doesNotMatch(body, /pull_request|repository_dispatch|schedule:|secrets\.|id-token:|contents: write|curl |wget |vercel (?:deploy|pull)|archive-device\.sh/);
  const actions = [...body.matchAll(/uses: (\S+)/g)].map(match => match[1]);
  assert.deepEqual(actions, [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  ]);
  assert.match(body, /run: npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(body, /working-directory: native\n        run: bash scripts\/build-simulator\.sh/);
  assert.match(body, /working-directory: native\n        timeout-minutes: 12\n        run: node scripts\/smoke-simulator\.mjs/);
  assert.match(body, /name: WOVO-anonymous-runtime-smoke/);
  assert.match(body, /native\/build\/runtime-smoke\/anonymous-launch-early\.png\n            native\/build\/runtime-smoke\/anonymous-launch\.png\n            native\/build\/runtime-smoke\/summary\.json/);
  assert.match(body, /path: native\/build\/WOVO-Internal-simulator\.zip\n          retention-days: 3\n          if-no-files-found: error/);
  const compile = await read('scripts/build-simulator.sh');
  assert.match(compile, /swiftc ios\/App\/App\/WovoNavigationPolicy\.swift tests\/navigation-policy-tests\.swift/);
  assert.match(compile, /xcodebuild -project ios\/App\/App\.xcodeproj -scheme App/);
  assert.match(compile, /CODE_SIGNING_ALLOWED=NO build/);
  assert.doesNotMatch(compile, /\.\.\/|prepare-brand|--prod|-allowProvisioningUpdates/);
});

test('reviewed native-only payload maps exactly the simulator, validation-only workflow and no-deploy guard', async () => {
  const manifest = await json('public-source-manifest.json');
  assert.equal(manifest.upload.repository, 'wovomedia/wovo-media');
  assert.equal(manifest.upload.newBranch, 'wovo-ios-build');
  assert.equal(manifest.upload.firstCommitRequiresAllMappings, true);
  assert.deepEqual(manifest.upload.mappings, [
    { source: 'native/ci/github-ios-build.yml', destination: '.github/workflows/wovo-ios-build.yml' },
    { source: 'native/ci/github-ios-testflight.yml', destination: '.github/workflows/wovo-ios-testflight.yml' },
    { source: 'native/ci/vercel.no-deploy.json', destination: 'vercel.json' },
  ]);
  assert.deepEqual(await json('ci/vercel.no-deploy.json'), {
    $schema: 'https://openapi.vercel.sh/vercel.json', git: { deploymentEnabled: false },
  });
  const destinations = [...manifest.files, ...manifest.upload.mappings.map(item => item.destination)];
  assert.equal(new Set(destinations).size, destinations.length);
  assert.ok(!manifest.files.includes('native/scripts/prepare-brand.mjs'), 'canonical-only packaging helper must not need the parent web tree');
  for (const source of manifest.files) {
    assert.ok(source.startsWith('native/') && !source.includes('..') && !source.includes('\\'));
    assert.doesNotMatch(source, /node_modules|(?:^|\/)build\/|\.env|\.(?:p8|p12|mobileprovision|pem|key|cer)$|verification|\/public\/|Splash\.imageset|config\.xml|capacitor-cordova-ios-plugins/);
    assert.ok((await lstat(new URL(`../${source}`, root))).isFile(), 'each source is an ordinary file, not a directory/symlink');
  }
  for (const mapping of manifest.upload.mappings) assert.ok(manifest.files.includes(mapping.source));
  for (const required of ['native/package.json', 'native/package-lock.json', 'native/capacitor.config.json', 'native/tests/ci-upload.test.mjs', 'native/scripts/build-simulator.sh', 'native/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme']) assert.ok(manifest.files.includes(required));
});

test('validation1 request and mapped workflow cannot become an upload through variable changes', async () => {
  assert.deepEqual(await json('ci/testflight-request.json'), {
    request: 'validation1', version: '1.0', build: '1', operation: 'validate-only',
  });
  const body = await read('ci/github-ios-testflight.yml');
  assert.match(body, /push:\n    branches: \[wovo-ios-build\]\n    paths: \[native\/ci\/testflight-request\.json\]/);
  assert.match(body, /github\.repository == 'wovomedia\/wovo-media'/);
  assert.match(body, /vars\.WOVO_IOS_SIGNING_ENABLED == 'true' && vars\.WOVO_REVIEWED_SHA == github\.sha/);
  assert.match(body, /environment: ios-internal-signing/);
  assert.match(body, /permissions:\n  contents: read/);
  assert.match(body, /WOVO_RELEASE_OPERATION: validate-only/);
  assert.match(body, /WOVO_APP_VERSION: '1\.0'/);
  assert.match(body, /WOVO_BUILD_NUMBER: '1'/);
  assert.match(body, /WOVO_TRIGGER_ACK: REVIEWED_NATIVE_PUSH/);
  assert.match(body, /persist-credentials: false/);
  assert.match(body, /run: node scripts\/testflight-release\.mjs/);
  assert.doesNotMatch(body, /WOVO_UPLOAD_ACK|vars\.WOVO_RELEASE_OPERATION|workflow_dispatch:|pull_request:|upload-artifact@|contents: write|id-token:/);
  for (const match of body.matchAll(/uses: (\S+)/g)) assert.match(match[1], /@[a-f0-9]{40}$/);
  const manifest = await json('public-source-manifest.json');
  assert.ok(manifest.files.includes('native/ci/testflight-request.json'));
  assert.ok(manifest.files.includes('native/ci/github-ios-testflight.yml'));
  assert.ok(manifest.files.includes('native/scripts/testflight-release.mjs'));
});

test('native lockfile uses only pinned registry packages without credentials or local links', async () => {
  const lock = await json('package-lock.json');
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (!name) continue;
    assert.equal(pkg.link, undefined);
    assert.ok(typeof pkg.version === 'string');
    const url = new URL(pkg.resolved);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'registry.npmjs.org');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.match(pkg.integrity, /^sha512-/);
  }
});
