import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BUNDLE_ID, PROFILE_JSON_ADAPTER, childEnvironment, classifyTransporterFailure, decodeSecret, exportOptions, matchingIdentity, release, runCommand, transportArguments,
  validateDistributionProfile, validateReleaseEnvironment } from '../scripts/testflight-release.mjs';

const team = 'ABCDE12345';
const uuid = '11111111-2222-4333-8444-555555555555';
const cert = Buffer.from('test distribution certificate, not a credential');
const certHash = createHash('sha1').update(cert).digest('hex').toUpperCase();
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const b64 = text => Buffer.from(text).toString('base64');
const profile = () => ({ UUID: uuid, Name: 'WOVO fixture', TeamIdentifier: [team], Platform: ['iOS'],
  ExpirationDate: '2099-01-01T00:00:00Z', DeveloperCertificates: [cert.toString('base64')],
  Entitlements: { 'application-identifier': `${team}.${BUNDLE_ID}`, 'com.apple.developer.team-identifier': team, 'get-task-allow': false } });
const typedProfileXml = () => `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
<key>UUID</key><string>${uuid}</string><key>Name</key><string>WOVO fixture</string>
<key>TeamIdentifier</key><array><string>${team}</string></array><key>Platform</key><array><string>iOS</string></array>
<key>ExpirationDate</key><date>2099-01-01T00:00:00Z</date>
<key>DeveloperCertificates</key><array><data>${cert.toString('base64')}</data></array>
<key>Entitlements</key><dict><key>application-identifier</key><string>${team}.${BUNDLE_ID}</string>
<key>com.apple.developer.team-identifier</key><string>${team}</string><key>get-task-allow</key><false/></dict>
</dict></plist>`;
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const privatePython = (script, input) => runCommand(pythonCommand, ['-c', script], { input, env: childEnvironment(process.env) });
const appleOperation = args => args[0] !== 'altool' ? null : args.includes('--validate-app') ? 'verify' : args.includes('--upload-app') ? 'upload' : null;
const environment = temp => ({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'macOS',
  GITHUB_REPOSITORY: 'wovomedia/wovo-media', GITHUB_REF: 'refs/heads/wovo-ios-build', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_SHA: 'a'.repeat(40), WOVO_REVIEWED_SHA: 'a'.repeat(40), WOVO_IOS_SIGNING_ENABLED: 'true',
  WOVO_RELEASE_ACK: 'BUILD_REVIEWED_NATIVE_SOURCE', WOVO_APPLE_TEAM_ID: team, WOVO_ASC_KEY_ID: 'ABC1234567',
  WOVO_ASC_ISSUER_ID: uuid, WOVO_BUILD_NUMBER: '2', WOVO_APP_VERSION: '1.0', WOVO_RELEASE_OPERATION: 'validate-only',
  RUNNER_TEMP: temp, WOVO_P12_BASE64: b64('synthetic encrypted p12'), WOVO_P12_PASSWORD: 'test-password-never-output',
  WOVO_PROFILE_BASE64: b64('synthetic profile'), WOVO_ASC_P8_BASE64: b64(key) });

async function fixture(t, overrides = {}, failAt) {
  const directory = await mkdtemp(path.join(tmpdir(), 'wovo-release-fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { ...environment(directory), ...overrides };
  const calls = [];
  const logs = [];
  const runnerHome = path.join(directory, 'home');
  await mkdir(runnerHome);
  const run = async (name, args, options) => {
    calls.push({ name, args, env: options.env, cwd: options.cwd, diagnosticType: options.diagnosticType });
    assert.equal(options.env.WOVO_P12_PASSWORD, undefined);
    assert.equal(options.env.WOVO_ASC_P8_BASE64, undefined);
    if (!appleOperation(args)) assert.equal(options.env.API_PRIVATE_KEYS_DIR, undefined);
    const injectedFailure = failAt?.(name, args);
    if (injectedFailure) throw injectedFailure instanceof Error ? injectedFailure : new Error(`should never leak ${env.WOVO_P12_PASSWORD}`);
    if (name === 'git') return env.GITHUB_SHA;
    if (name === 'xcodebuild' && args[0] === '-version') return 'Xcode 26.6\nBuild version 26F01';
    if (name === 'xcrun' && args.includes('--show-sdk-version')) return '26.6';
    if (name === 'security' && args[0] === 'cms') return typedProfileXml();
    if (name === 'python3') {
      assert.deepEqual(args, ['-c', PROFILE_JSON_ADAPTER]);
      assert.equal(options.input, typedProfileXml());
      return JSON.stringify(profile());
    }
    if (name === 'security' && args[0] === 'create-keychain') await writeFile(args.at(-1), 'synthetic keychain');
    if (name === 'security' && args[0] === 'find-identity') return `1) ${certHash} "Apple Distribution: Fixture (${team})"`;
    if (name === 'security' && args[0] === 'list-keychains' && !args.includes('-s')) return '"/existing/login.keychain-db"\n';
    if (name === 'plutil') return String(options.input);
    if (name === 'xcodebuild' && args.at(-1) === 'archive') {
      const archived = args[args.indexOf('-archivePath') + 1];
      const app = path.join(archived, 'Products', 'Applications', 'App.app');
      await mkdir(app, { recursive: true });
      await writeFile(path.join(app, 'Info.plist'), JSON.stringify({ CFBundleIdentifier: BUNDLE_ID, CFBundleVersion: env.WOVO_BUILD_NUMBER, CFBundleShortVersionString: env.WOVO_APP_VERSION }));
      assert.ok(!(await readdir(path.dirname(archived))).includes('private_keys'), 'API key is not written until the IPA exists');
    }
    if (name === 'xcodebuild' && args[0] === '-exportArchive') {
      const exported = args[args.indexOf('-exportPath') + 1];
      await mkdir(exported);
      await writeFile(path.join(exported, 'App.ipa'), 'synthetic signed IPA');
      const optionsFile = await readFile(args[args.indexOf('-exportOptionsPlist') + 1], 'utf8');
      assert.match(optionsFile, /<key>destination<\/key><string>export<\/string>/);
      assert.doesNotMatch(optionsFile, /<string>upload<\/string>/);
    }
    if (name === 'xcrun' && appleOperation(args)) {
      const privatePath = path.join(options.cwd, 'private_keys', `AuthKey_${env.WOVO_ASC_KEY_ID}.p8`);
      assert.equal(options.env.API_PRIVATE_KEYS_DIR, path.dirname(privatePath));
      assert.equal(await readFile(privatePath, 'utf8'), key);
      assert.ok(calls.some(call => call.name === 'codesign'));
    }
    return '';
  };
  return { directory, env, calls, logs, runnerHome, execute: () => release({ env, platform: 'darwin', runnerHome, root: directory, run, log: text => logs.push(text) }) };
}

test('release is denied before commands or secret access without every manual runner/source gate', async t => {
  for (const change of [{ WOVO_IOS_SIGNING_ENABLED: 'false' }, { GITHUB_EVENT_NAME: 'push' }, { GITHUB_REF: 'refs/heads/main' },
    { GITHUB_REPOSITORY: 'someone/fork' }, { WOVO_REVIEWED_SHA: 'b'.repeat(40) }, { RUNNER_ENVIRONMENT: 'self-hosted' },
    { WOVO_RELEASE_ACK: '' }, { ACTIONS_STEP_DEBUG: 'true' }, { WOVO_BUILD_NUMBER: '2;bad' }, { WOVO_RELEASE_OPERATION: 'upload-to-testflight' }]) {
    const f = await fixture(t, change);
    await assert.rejects(f.execute);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await readdir(f.directory), ['home']);
  }
  assert.throws(() => validateReleaseEnvironment(environment(tmpdir()), 'win32'));
});

test('profile gate rejects expired, development, enterprise, ad-hoc, wildcard and wrong-team profiles', () => {
  assert.deepEqual(validateDistributionProfile(profile(), team), [certHash]);
  for (const changed of [{ ...profile(), ExpirationDate: '2020-01-01' }, { ...profile(), ProvisionsAllDevices: true },
    { ...profile(), ProvisionedDevices: [] }, { ...profile(), TeamIdentifier: ['OTHER12345'] },
    { ...profile(), Entitlements: { ...profile().Entitlements, 'get-task-allow': true } },
    { ...profile(), Entitlements: { ...profile().Entitlements, 'application-identifier': `${team}.*` } }]) {
    assert.throws(() => validateDistributionProfile(changed, team));
  }
  assert.throws(() => matchingIdentity(`1) ${'F'.repeat(40)} "Apple Distribution: Wrong"`, [certHash]));
  assert.equal(matchingIdentity(`1) ${certHash} "Apple Distribution: Correct"`, [certHash]), certHash);
});

test('actual profile adapter preserves typed XML and binary plist dates and certificate bytes', async () => {
  const binaryBase64 = await privatePython('import base64, plistlib, sys; sys.stdout.write(base64.b64encode(plistlib.dumps(plistlib.loads(sys.stdin.buffer.read()), fmt=plistlib.FMT_BINARY)).decode("ascii"))', typedProfileXml());
  for (const input of [typedProfileXml(), Buffer.from(binaryBase64, 'base64')]) {
    const parsed = JSON.parse(await privatePython(PROFILE_JSON_ADAPTER, input));
    assert.deepEqual(parsed, profile());
    assert.deepEqual(validateDistributionProfile(parsed, team), [certHash]);
    assert.throws(() => validateDistributionProfile(parsed, 'OTHER12345'));
    assert.throws(() => validateDistributionProfile({ ...parsed, ExpirationDate: '2000-01-01T00:00:00Z' }, team));
  }
});

test('profile adapter fails closed for malformed or oversized inputs', async () => {
  await assert.rejects(() => privatePython(PROFILE_JSON_ADAPTER, 'not a plist'));
  await assert.rejects(() => privatePython(PROFILE_JSON_ADAPTER, 'x'.repeat(2_000_001)));
});

test('a failed profile decoder stops before importing any signing identity or archiving', async t => {
  const f = await fixture(t, {}, name => name === 'python3');
  await assert.rejects(f.execute, /Native release stopped at profile verification/);
  assert.ok(!f.calls.some(call => call.name === 'security' && ['create-keychain', 'import'].includes(call.args[0])));
  assert.ok(!f.calls.some(call => call.name === 'xcodebuild' && call.args.at(-1) === 'archive'));
  assert.ok(!f.calls.some(call => appleOperation(call.args)));
  assert.deepEqual((await readdir(f.directory)).filter(name => name.startsWith('wovo-signing-')), []);
});

test('secret decoding and child environments do not forward signing secrets', () => {
  assert.throws(() => decodeSecret('not base64!', 100));
  assert.throws(() => decodeSecret(b64('oversized'), 1));
  assert.equal(decodeSecret(b64('ok'), 2).toString(), 'ok');
  assert.equal(childEnvironment({ PATH: '/usr/bin', WOVO_P12_PASSWORD: 'no', WOVO_ASC_P8_BASE64: 'no' }).PATH, '/usr/bin');
  assert.deepEqual(Object.keys(childEnvironment({ WOVO_P12_PASSWORD: 'no', WOVO_ASC_P8_BASE64: 'no' })), []);
  assert.equal(childEnvironment({ API_PRIVATE_KEYS_DIR: '/untrusted/external' }).API_PRIVATE_KEYS_DIR, undefined);
  assert.throws(() => exportOptions({ team: '<bad>' }, uuid, certHash));
  assert.throws(() => transportArguments('submit-review', 'App.ipa', {}));
  for (const operation of ['verify', 'upload']) assert.deepEqual(transportArguments(operation, '/private/App.ipa', { keyId: 'ABC1234567', issuer: uuid }),
    ['altool', operation === 'verify' ? '--validate-app' : '--upload-app', '-f', '/private/App.ipa', '-t', 'ios', '--apiKey', 'ABC1234567', '--apiIssuer', uuid, '--output-format', 'json']);
});

test('Transporter classifier emits only bounded numeric contextual codes and fixed categories', () => {
  const sensitive = '/private/runner/AuthKey_PRIVATE123.p8 account@example.invalid eyJ.never.log.this';
  const result = classifyTransporterFailure({ exitCode: 1,
    stdout: `ERROR ITMS-90161: ${sensitive}\nITMS-90161\nITMS-123456\nkeyId=1234567890`,
    stderr: `Error Domain=ContentDelivery Code=-1011 ${sensitive}\nAsset validation failed (90035)\nERROR: -18000\nAuthentication failed`,
  });
  assert.deepEqual(result, { exitCode: 1, itmsCodes: [90161], errorCodes: [-18000, 90035, -1011],
    categories: ['authentication-rejected', 'asset-validation'] });
  assert.doesNotMatch(JSON.stringify(result), /private|PRIVATE123|example|eyJ|ContentDelivery|1234567890/);
  assert.deepEqual(classifyTransporterFailure({ exitCode: '1', stdout: 'ITMS-12345\n' + 'x'.repeat(70_000) }),
    { exitCode: null, itmsCodes: [], errorCodes: [], categories: ['unclassified'] });
  assert.equal(classifyTransporterFailure({ stderr: Array.from({ length: 30 }, (_, i) => `ITMS-${90000 + i}`).join('\n') }).itmsCodes.length, 8);
  for (const suffix of ['PRIVATE_TOKEN', '_PRIVATE_TOKEN', '-PRIVATE_TOKEN', '/PRIVATE_TOKEN', '=PRIVATE_TOKEN', '+PRIVATE_TOKEN', '@PRIVATE_TOKEN']) {
    const fakeCodes = classifyTransporterFailure({ stderr: `Error: 123456${suffix}\nError Domain=Service Code=-123${suffix}\nITMS-90161${suffix}\nAsset validation failed (90035)${suffix}` });
    assert.deepEqual(fakeCodes.itmsCodes, []);
    assert.deepEqual(fakeCodes.errorCodes, []);
  }
  for (const [input, category] of [
    [{ spawnCode: 'ENOENT' }, 'tool-unavailable'], [{ spawnCode: 'ABORT_ERR' }, 'interrupted'],
    [{ outputLimitExceeded: true }, 'output-limit'], [{ stderr: 'Cannot find private key at /private/secret.p8' }, 'private-key-unavailable'],
    [{ stderr: 'Connection timed out' }, 'network-failure'], [{ stderr: 'Unknown option -private-secret' }, 'unsupported-option'],
  ]) assert.ok(classifyTransporterFailure(input).categories.includes(category));
});

test('actual child diagnostics retain stdout/stderr error codes without raw output and other commands stay generic', async () => {
  const script = 'process.stdout.write("ERROR ITMS-90161: /private/no-output"); process.stderr.write("Error Domain=ContentDelivery Code=-1011 token=DO_NOT_LOG"); process.exitCode=7;';
  await assert.rejects(() => runCommand(process.execPath, ['-e', script], { diagnosticType: 'transporter' }), error => {
    assert.equal(error.message, 'Command failed.');
    assert.deepEqual(error.transporterDiagnostic, { exitCode: 7, itmsCodes: [90161], errorCodes: [-1011], categories: ['asset-validation'] });
    assert.doesNotMatch(JSON.stringify(error), /private|DO_NOT_LOG|ContentDelivery/);
    assert.equal(error.stdout, undefined);
    assert.equal(error.stderr, undefined);
    return true;
  });
  await assert.rejects(() => runCommand(process.execPath, ['-e', script]), error => {
    assert.equal(error.message, 'Command failed.');
    assert.equal(error.transporterDiagnostic, undefined);
    assert.doesNotMatch(JSON.stringify(error), /private|DO_NOT_LOG|ITMS|1011/);
    return true;
  });
});

test('altool structured diagnostics accept only numeric codes in known bounded error arrays', () => {
  const result = classifyTransporterFailure({ stdout: JSON.stringify({
    'product-errors': [{ code: -1011, message: 'private secret' }, { code: '90161' }, { code: '123PRIVATE_TOKEN' }],
    errors: [{ code: -18000 }, { code: 1234567890 }, { code: 1.5 }],
    code: 98765, requestId: 'must not be logged', nested: { errors: [{ code: 77777 }] },
  }) });
  assert.deepEqual(result.errorCodes, [-1011, 90161, -18000]);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|must not|requestId|98765|77777|1234567890/);
  assert.deepEqual(classifyTransporterFailure({ stdout: JSON.stringify({ errors: [{ code: -1011 }], padding: 'x'.repeat(70_000) }) }).errorCodes, []);
  assert.deepEqual(classifyTransporterFailure({ stdout: '[{"code":-1011}]' }).errorCodes, []);
});

test('failed altool startup emits only sanitized preflight diagnostics before installing signing material', async t => {
  const failure = new Error('private tool startup output');
  failure.transporterDiagnostic = classifyTransporterFailure({ exitCode: 1, stderr: 'Unable to locate a Java Runtime. /private/secret' });
  const f = await fixture(t, {}, (name, args) => name === 'xcrun' && args[0] === 'altool' && args.includes('--version') ? failure : false);
  await assert.rejects(f.execute, /Native release stopped at Apple tool preflight/);
  assert.deepEqual(f.logs.map(line => JSON.parse(line)), [{ event: 'apple-tool-failure', tool: 'altool', exitCode: 1,
    itmsCodes: [], errorCodes: [], categories: ['tool-unavailable'] }]);
  assert.ok(!f.calls.some(call => call.name === 'security' || appleOperation(call.args)));
  assert.deepEqual(await readdir(f.directory), ['home']);
});

test('release logs revalidated safe Transporter diagnostics only at Apple failure and never uploads after failed verify', async t => {
  const failure = new Error('raw /private/path and secret MUST_NOT_APPEAR');
  failure.transporterDiagnostic = { exitCode: 1, itmsCodes: [90161, 'raw-private-value', 1234567890],
    errorCodes: [-1011, 'secret'], categories: ['asset-validation', 'raw-private-category'], path: '/private/no' };
  const f = await fixture(t, {}, (name, args) => name === 'xcrun' && appleOperation(args) ? failure : false);
  await assert.rejects(f.execute, /Native release stopped at Apple validation/);
  assert.deepEqual(f.logs.filter(line => line.startsWith('{')).map(line => JSON.parse(line)), [{
    event: 'apple-tool-failure', tool: 'altool', exitCode: 1, itmsCodes: [90161], errorCodes: [-1011], categories: ['asset-validation'],
  }]);
  assert.doesNotMatch(f.logs.filter(line => !line.startsWith('::add-mask::')).join('\n'), /private|MUST_NOT_APPEAR|raw-/);
  assert.ok(f.calls.filter(call => call.diagnosticType).every(call => call.name === 'xcrun' && call.args[0] === 'altool'));
  assert.equal(f.calls.filter(call => appleOperation(call.args)).length, 1);
  assert.deepEqual((await readdir(f.directory)).filter(name => name.startsWith('wovo-signing-')), []);

  const unrelated = await fixture(t, {}, (name, args) => name === 'security' && args[0] === 'import' ? failure : false);
  await assert.rejects(unrelated.execute, /Native release stopped at temporary keychain/);
  assert.ok(!unrelated.logs.some(line => line.includes('apple-tool-failure')));
});

test('non-default push trigger still requires its explicit acknowledgement and exact reviewed SHA', () => {
  const env = { ...environment(tmpdir()), GITHUB_EVENT_NAME: 'push', WOVO_TRIGGER_ACK: 'REVIEWED_NATIVE_PUSH' };
  assert.equal(validateReleaseEnvironment(env, 'darwin').sha, env.GITHUB_SHA);
  assert.throws(() => validateReleaseEnvironment({ ...env, WOVO_REVIEWED_SHA: 'b'.repeat(40) }, 'darwin'));
  assert.throws(() => validateReleaseEnvironment({ ...env, WOVO_TRIGGER_ACK: '' }, 'darwin'));
});

test('validation builds and checks one exact IPA, never uploads, restores keychains and removes private material', async t => {
  const f = await fixture(t, { API_PRIVATE_KEYS_DIR: '/untrusted/external' });
  const result = await f.execute();
  assert.equal(result.operation, 'validate-only');
  const transport = f.calls.filter(call => appleOperation(call.args));
  assert.deepEqual(transport.map(call => appleOperation(call.args)), ['verify']);
  const preflightIndex = f.calls.findIndex(call => call.name === 'xcrun' && call.args[0] === 'altool' && call.args.includes('--version'));
  assert.ok(preflightIndex >= 0 && preflightIndex < f.calls.findIndex(call => call.name === 'security'));
  assert.equal(f.calls.filter(call => call.name === 'swiftc').length, 2);
  const archive = f.calls.find(call => call.name === 'xcodebuild' && call.args.at(-1) === 'archive');
  assert.ok(archive.args.includes('CODE_SIGN_STYLE=Manual'));
  assert.ok(archive.args.includes(`CODE_SIGN_IDENTITY=${certHash}`));
  assert.ok(archive.args.includes('CURRENT_PROJECT_VERSION=2'));
  assert.ok(!archive.args.some(arg => /allowProvisioning/.test(arg)));
  assert.deepEqual(f.calls.filter(call => call.name === 'security' && call.args[0] === 'list-keychains').at(-1).args,
    ['list-keychains', '-d', 'user', '-s', '/existing/login.keychain-db']);
  assert.deepEqual((await readdir(f.directory)).filter(name => name.startsWith('wovo-signing-')), []);
  for (const directory of ['Library/MobileDevice/Provisioning Profiles', 'Library/Developer/Xcode/UserData/Provisioning Profiles']) {
    assert.deepEqual(await readdir(path.join(f.runnerHome, directory)), []);
  }
  assert.ok(f.logs.some(line => line.startsWith('::add-mask::')));
  assert.ok(!f.logs.filter(line => !line.startsWith('::add-mask::')).join('\n').includes(f.env.WOVO_P12_PASSWORD));
});

test('separate upload opt-in validates first, uploads exactly once, and never submits review or invites', async t => {
  const f = await fixture(t, { WOVO_RELEASE_OPERATION: 'upload-to-testflight', WOVO_UPLOAD_ACK: 'UPLOAD_BUILD_ONLY' });
  await f.execute();
  assert.deepEqual(f.calls.filter(call => appleOperation(call.args)).map(call => appleOperation(call.args)), ['verify', 'upload']);
  assert.ok(f.logs.some(line => line.includes('upload-command-succeeded-processing-unverified')));
  assert.doesNotMatch(JSON.stringify(f.calls.map(call => [call.name, call.args])), /betaGroups|appStoreVersionSubmissions|allowProvisioning|notarytool/);
});

test('an identical preinstalled profile is reused and never removed by cleanup', async t => {
  const f = await fixture(t);
  const directory = path.join(f.runnerHome, 'Library', 'MobileDevice', 'Provisioning Profiles');
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${uuid}.mobileprovision`);
  const bytes = Buffer.from(f.env.WOVO_PROFILE_BASE64, 'base64');
  await writeFile(target, bytes);
  await f.execute();
  assert.deepEqual(await readFile(target), bytes);
  assert.deepEqual(await readdir(directory), [`${uuid}.mobileprovision`]);
});

test('a differing preinstalled profile is not overwritten or removed and prevents archive', async t => {
  const f = await fixture(t);
  const directory = path.join(f.runnerHome, 'Library', 'MobileDevice', 'Provisioning Profiles');
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${uuid}.mobileprovision`);
  await writeFile(target, 'existing unrelated profile');
  await assert.rejects(f.execute, /Native release stopped/);
  assert.equal(await readFile(target, 'utf8'), 'existing unrelated profile');
  assert.ok(!f.calls.some(call => call.name === 'xcodebuild' && call.args.at(-1) === 'archive'));
  assert.ok(f.calls.some(call => call.name === 'security' && call.args[0] === 'delete-keychain'));
});

for (const failure of ['import', 'archive', 'export', 'verify', 'upload']) {
  test(`failure at ${failure} stops downstream actions and cleans up without a blind retry`, async t => {
    const f = await fixture(t, { WOVO_RELEASE_OPERATION: 'upload-to-testflight', WOVO_UPLOAD_ACK: 'UPLOAD_BUILD_ONLY' },
      (name, args) => failure === 'import' ? name === 'security' && args[0] === 'import'
        : failure === 'archive' ? name === 'xcodebuild' && args.at(-1) === 'archive'
          : failure === 'export' ? name === 'xcodebuild' && args[0] === '-exportArchive'
            : name === 'xcrun' && appleOperation(args) === failure);
    await assert.rejects(f.execute, error => error.message.includes('Native release stopped') && !error.message.includes(f.env.WOVO_P12_PASSWORD));
    const uploads = f.calls.filter(call => appleOperation(call.args) === 'upload');
    assert.equal(uploads.length, failure === 'upload' ? 1 : 0);
    assert.deepEqual((await readdir(f.directory)).filter(name => name.startsWith('wovo-signing-')), []);
    assert.ok(f.calls.some(call => call.name === 'security' && call.args[0] === 'delete-keychain'));
  });
}

test('dormant template requires dispatch, enable flag, environment and exact branch, with no secret artifact upload', async () => {
  const body = await readFile(new URL('../ci/github-ios-testflight.yml.example', import.meta.url), 'utf8');
  assert.match(body, /on:\n  workflow_dispatch:/);
  assert.match(body, /environment: ios-internal-signing/);
  assert.match(body, /vars\.WOVO_IOS_SIGNING_ENABLED == 'true'/);
  assert.match(body, /github\.ref == 'refs\/heads\/wovo-ios-build'/);
  assert.match(body, /persist-credentials: false/);
  assert.match(body, /default: validate-only/);
  assert.match(body, /cancel-in-progress: false/);
  assert.match(body, /permissions:\n  contents: read/);
  assert.doesNotMatch(body, /\n  (?:push|pull_request|schedule|repository_dispatch):|upload-artifact@|contents: write|id-token:|allowProvisioningUpdates/);
  for (const match of body.matchAll(/uses: (\S+)/g)) assert.match(match[1], /@[a-f0-9]{40}$/);
});

test('dormant non-default trigger signs only a changed request file at the separately approved exact SHA', async () => {
  const body = await readFile(new URL('../ci/github-ios-testflight-push.yml.example', import.meta.url), 'utf8');
  assert.match(body, /push:\n    branches: \[wovo-ios-build\]\n    paths: \[native\/ci\/testflight-request\.json\]/);
  assert.match(body, /vars\.WOVO_REVIEWED_SHA == github\.sha/);
  assert.match(body, /vars\.WOVO_IOS_SIGNING_ENABLED == 'true'/);
  assert.match(body, /WOVO_TRIGGER_ACK: REVIEWED_NATIVE_PUSH/);
  assert.match(body, /environment: ios-internal-signing/);
  assert.doesNotMatch(body, /workflow_dispatch:|pull_request:|repository_dispatch:|upload-artifact@|contents: write/);
  for (const match of body.matchAll(/uses: (\S+)/g)) assert.match(match[1], /@[a-f0-9]{40}$/);
});
