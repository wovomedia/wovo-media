// DORMANT, operator-gated GitHub-hosted macOS release runner. No credential creation.
import { spawn } from 'node:child_process';
import { createHash, createPrivateKey, randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUNDLE_ID = 'com.wovomedia.wovo';
const SECRET_NAMES = ['WOVO_P12_BASE64', 'WOVO_P12_PASSWORD', 'WOVO_PROFILE_BASE64', 'WOVO_ASC_P8_BASE64'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const nativeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireTrue(condition, message) { if (!condition) throw new Error(message); }

export function validateReleaseEnvironment(env, platform) {
  requireTrue(platform === 'darwin' && env.GITHUB_ACTIONS === 'true'
    && env.RUNNER_ENVIRONMENT === 'github-hosted' && env.RUNNER_OS === 'macOS', 'Requires a fresh GitHub-hosted macOS runner.');
  requireTrue(env.GITHUB_REPOSITORY === 'wovomedia/wovo-media'
    && env.GITHUB_REF === 'refs/heads/wovo-ios-build'
    && (env.GITHUB_EVENT_NAME === 'workflow_dispatch'
      || (env.GITHUB_EVENT_NAME === 'push' && env.WOVO_TRIGGER_ACK === 'REVIEWED_NATIVE_PUSH')), 'Only the explicitly reviewed native release trigger is allowed.');
  requireTrue(env.WOVO_IOS_SIGNING_ENABLED === 'true'
    && env.WOVO_RELEASE_ACK === 'BUILD_REVIEWED_NATIVE_SOURCE', 'Release is off by default.');
  requireTrue(!['1', 'true'].includes(env.RUNNER_DEBUG) && env.ACTIONS_STEP_DEBUG !== 'true', 'Disable debug logging for signing.');
  requireTrue(/^[a-f0-9]{40}$/.test(env.WOVO_REVIEWED_SHA ?? '')
    && env.WOVO_REVIEWED_SHA === env.GITHUB_SHA, 'Exact reviewed commit does not match this run.');
  requireTrue(/^[A-Z0-9]{10}$/.test(env.WOVO_APPLE_TEAM_ID ?? ''), 'A verified Apple Team ID is required.');
  requireTrue(/^[A-Z0-9]{10}$/.test(env.WOVO_ASC_KEY_ID ?? '') && UUID.test(env.WOVO_ASC_ISSUER_ID ?? ''), 'A team App Store Connect key ID and issuer ID are required.');
  requireTrue(/^[1-9][0-9]{0,3}$/.test(env.WOVO_BUILD_NUMBER ?? ''), 'Choose a unique build number from 1 to 9999.');
  requireTrue(/^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(env.WOVO_APP_VERSION ?? ''), 'A reviewed numeric app version is required.');
  requireTrue(['validate-only', 'upload-to-testflight'].includes(env.WOVO_RELEASE_OPERATION), 'Select validation or upload explicitly.');
  if (env.WOVO_RELEASE_OPERATION === 'upload-to-testflight') requireTrue(env.WOVO_UPLOAD_ACK === 'UPLOAD_BUILD_ONLY', 'Upload needs its separate explicit acknowledgement.');
  requireTrue(path.isAbsolute(env.RUNNER_TEMP ?? '') && env.RUNNER_TEMP !== path.parse(env.RUNNER_TEMP).root, 'A private runner temporary directory is required.');
  for (const name of SECRET_NAMES) requireTrue(typeof env[name] === 'string' && env[name].length > 0, `Missing protected environment secret: ${name}.`);
  return { team: env.WOVO_APPLE_TEAM_ID, keyId: env.WOVO_ASC_KEY_ID, issuer: env.WOVO_ASC_ISSUER_ID,
    build: env.WOVO_BUILD_NUMBER, version: env.WOVO_APP_VERSION, operation: env.WOVO_RELEASE_OPERATION, sha: env.WOVO_REVIEWED_SHA };
}

export function decodeSecret(value, limit) {
  const compact = value.replace(/\s/g, '');
  requireTrue(compact.length > 0 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact), 'Invalid secret encoding.');
  const bytes = Buffer.from(compact, 'base64');
  requireTrue(bytes.length <= limit && bytes.toString('base64') === compact, 'Invalid secret encoding or size.');
  return bytes;
}

export function validateDistributionProfile(profile, team, now = Date.now()) {
  requireTrue(UUID.test(profile.UUID ?? '') && typeof profile.Name === 'string' && profile.Name.length > 0, 'Invalid profile identity.');
  requireTrue(Array.isArray(profile.TeamIdentifier) && profile.TeamIdentifier.length === 1 && profile.TeamIdentifier[0] === team, 'Profile belongs to another team.');
  requireTrue(profile.Entitlements?.['application-identifier'] === `${team}.${BUNDLE_ID}`
    && profile.Entitlements?.['com.apple.developer.team-identifier'] === team, 'Profile is not for this exact app.');
  requireTrue(profile.Entitlements?.['get-task-allow'] === false && profile.ProvisionsAllDevices !== true
    && !Object.hasOwn(profile, 'ProvisionedDevices') && profile.Platform?.includes('iOS'), 'Use an App Store distribution profile, not development, ad-hoc or enterprise.');
  requireTrue(Date.parse(profile.ExpirationDate) > now + 3_600_000, 'Profile is expired or expires within an hour.');
  requireTrue(Array.isArray(profile.DeveloperCertificates) && profile.DeveloperCertificates.length > 0, 'Profile contains no signing certificates.');
  return profile.DeveloperCertificates.map(cert => createHash('sha1').update(decodeSecret(cert, 64_000)).digest('hex').toUpperCase());
}

// Real provisioning plists contain Date and Data nodes, which plutil cannot
// convert directly to JSON. Keep the CMS payload in private stdin/stdout and
// explicitly preserve those types for the strict profile validator above.
export const PROFILE_JSON_ADAPTER = `import base64, datetime, json, plistlib, sys
def encode(value):
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        return value.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    raise TypeError("Unsupported property-list value")
data = sys.stdin.buffer.read(2000001)
if len(data) > 2000000:
    raise ValueError("Property list exceeds limit")
json.dump(plistlib.loads(data), sys.stdout, default=encode, allow_nan=False, separators=(",", ":"))
`;

export function matchingIdentity(output, fingerprints) {
  const matches = [...output.matchAll(/\b([A-Fa-f0-9]{40})\s+"Apple Distribution:[^"\r\n]+"/g)]
    .map(match => match[1].toUpperCase()).filter(hash => fingerprints.includes(hash));
  requireTrue(new Set(matches).size === 1, 'Exactly one valid distribution identity must match the profile.');
  return matches[0];
}

export function exportOptions(config, profileUuid, fingerprint) {
  // All inserted values are constrained identifiers, never arbitrary XML.
  requireTrue(UUID.test(profileUuid) && /^[A-F0-9]{40}$/.test(fingerprint) && /^[A-Z0-9]{10}$/.test(config.team), 'Invalid export identity.');
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string><key>destination</key><string>export</string>
<key>signingStyle</key><string>manual</string><key>teamID</key><string>${config.team}</string>
<key>signingCertificate</key><string>${fingerprint}</string><key>manageAppVersionAndBuildNumber</key><false/>
<key>provisioningProfiles</key><dict><key>${BUNDLE_ID}</key><string>${profileUuid}</string></dict>
</dict></plist>`;
}

export function transportArguments(operation, ipa, config) {
  requireTrue(['verify', 'upload'].includes(operation), 'Unsupported delivery action.');
  return ['altool', operation === 'verify' ? '--validate-app' : '--upload-app', '-f', ipa, '-t', 'ios',
    '--apiKey', config.keyId, '--apiIssuer', config.issuer, '--output-format', 'json'];
}

export function childEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !SECRET_NAMES.includes(key) && !key.startsWith('WOVO_ASC_') && key !== 'API_PRIVATE_KEYS_DIR'));
}

const TRANSPORTER_CATEGORIES = ['tool-unavailable', 'interrupted', 'output-limit', 'private-key-unavailable',
  'authentication-rejected', 'network-failure', 'asset-validation', 'unsupported-option', 'unclassified'];
const DIAGNOSTIC_STREAM_LIMIT = 64 * 1024;

// Raw output is never attached to an error or written to a log. Only fixed
// categories and tightly contextualized numeric Apple/ITMS codes can leave here.
export function classifyTransporterFailure({ stdout = '', stderr = '', exitCode = null, outputLimitExceeded = false, spawnCode = '' } = {}) {
  const output = `${String(stdout).slice(-DIAGNOSTIC_STREAM_LIMIT)}\n${String(stderr).slice(-DIAGNOSTIC_STREAM_LIMIT)}`;
  const itmsCodes = [...new Set([...output.matchAll(/\bITMS-(\d{5})(?=$|[\s:;,.)\]}"'])/g)].map(match => Number(match[1])))].slice(0, 8);
  const errorCodes = new Set();
  for (const pattern of [
    /\b(?:ERROR|Error code)\s*:\s*(-?\d{3,6})(?=$|[\s:;,.)\]}"'])/gi,
    /\b(?:Asset validation failed|Validation failed)\s*\((-?\d{3,6})\)(?=$|[\s:;,.)\]}"'])/gi,
    /\bError Domain=[A-Za-z][A-Za-z0-9.]{0,80}\s+Code=(-?\d{3,6})(?=$|[\s:;,.)\]}"'])/g,
  ]) for (const match of output.matchAll(pattern)) errorCodes.add(Number(match[1]));
  // altool JSON is read only as a complete bounded document. Never walk arbitrary
  // objects or echo descriptions/IDs; inspect code fields in known error arrays.
  for (const stream of [stdout, stderr]) {
    if (typeof stream !== 'string' || stream.length > DIAGNOSTIC_STREAM_LIMIT) continue;
    try {
      const document = JSON.parse(stream);
      if (!document || typeof document !== 'object' || Array.isArray(document)) continue;
      for (const key of ['product-errors', 'errors']) {
        if (!Array.isArray(document[key])) continue;
        for (const item of document[key].slice(0, 16)) {
          const code = item?.code;
          if (typeof code === 'number' && Number.isInteger(code) && Math.abs(code) <= 999999) errorCodes.add(code);
          else if (typeof code === 'string' && /^-?\d{3,6}$/.test(code)) errorCodes.add(Number(code));
        }
      }
    } catch { /* Unstructured tool output is handled only by the strict patterns above. */ }
  }
  const categories = [];
  if (['ENOENT', 'EACCES'].includes(spawnCode) || /unable to find utility|could not find or load main class|unable to locate a java runtime|java: command not found/i.test(output)) categories.push('tool-unavailable');
  if (spawnCode === 'ABORT_ERR') categories.push('interrupted');
  if (outputLimitExceeded) categories.push('output-limit');
  if (/could not find (?:the )?private key|cannot find (?:the )?private key|private key (?:file )?(?:not found|is missing)|unable to (?:load|read) (?:the )?private key/i.test(output)) categories.push('private-key-unavailable');
  if (/authentication (?:failed|failure)|unable to authenticate|(?:authentication )?credentials (?:are )?(?:missing|invalid)|not authorized|unauthorized|invalid (?:jwt|token)|token (?:has )?expired/i.test(output)) categories.push('authentication-rejected');
  if (/connection (?:timed out|refused|reset)|unknown host|unable to resolve host|network is unreachable|could not connect|ssl handshake/i.test(output)) categories.push('network-failure');
  if (itmsCodes.length || /asset validation failed|validation failed|invalid binary|invalid provisioning profile/i.test(output)) categories.push('asset-validation');
  if (/unrecognized option|unknown option|invalid (?:option|argument)|unsupported (?:option|argument)|not a valid option/i.test(output)) categories.push('unsupported-option');
  return { exitCode: Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255 ? exitCode : null,
    itmsCodes, errorCodes: [...errorCodes].slice(0, 8), categories: categories.length ? categories : ['unclassified'] };
}

function safeTransporterDiagnostic(value) {
  const codes = input => Array.isArray(input) ? [...new Set(input.filter(code => Number.isInteger(code) && Math.abs(code) <= 999999))].slice(0, 8) : [];
  const categories = Array.isArray(value?.categories) ? value.categories.filter(category => TRANSPORTER_CATEGORIES.includes(category)) : [];
  return { exitCode: Number.isInteger(value?.exitCode) && value.exitCode >= 0 && value.exitCode <= 255 ? value.exitCode : null,
    itmsCodes: codes(value?.itmsCodes).filter(code => code >= 10000 && code <= 99999), errorCodes: codes(value?.errorCodes),
    categories: categories.length ? [...new Set(categories)] : ['unclassified'] };
}

// Never logs a command, its arguments or raw tool output. Failures identify a stage.
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, signal: options.signal,
      stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    let output = '';
    let diagnosticStdout = '';
    let diagnosticStderr = '';
    let size = 0;
    let failed = false;
    const failure = (exitCode, spawnCode = '') => {
      const error = new Error('Command failed.');
      if (options.diagnosticType === 'transporter') error.transporterDiagnostic = classifyTransporterFailure({
        stdout: diagnosticStdout, stderr: diagnosticStderr, exitCode, spawnCode, outputLimitExceeded: failed,
      });
      return error;
    };
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (options.diagnosticType === 'transporter') diagnosticStdout = (diagnosticStdout + chunk.toString()).slice(-DIAGNOSTIC_STREAM_LIMIT);
      if (size > 32 * 1024 * 1024) { failed = true; child.kill('SIGTERM'); }
      else output += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      size += chunk.length;
      if (options.diagnosticType === 'transporter') diagnosticStderr = (diagnosticStderr + chunk.toString()).slice(-DIAGNOSTIC_STREAM_LIMIT);
      if (size > 32 * 1024 * 1024) { failed = true; child.kill('SIGTERM'); }
    });
    child.on('error', error => reject(failure(null, error.code)));
    child.on('close', code => code === 0 && !failed ? resolve(output) : reject(failure(code)));
    child.stdin.on('error', () => {});
    child.stdin.end(options.input);
  });
}

async function privateWrite(file, bytes) { await writeFile(file, bytes, { mode: 0o600, flag: 'wx' }); }
async function plainFile(file) { const stat = await lstat(file); requireTrue(stat.isFile() && !stat.isSymbolicLink(), 'Expected a regular private file.'); }

export async function release({ env = process.env, platform = process.platform, runnerHome = homedir(), root = nativeRoot,
  run = runCommand, log = console.log, signal } = {}) {
  // Validate opt-in before inspecting any secret or touching disk.
  const config = validateReleaseEnvironment(env, platform);
  const cleanEnv = childEnvironment(env);
  let stage = 'preflight';
  let temporary = '';
  let keychain = '';
  let searchListChanged = false;
  let previousKeychains = [];
  const installedProfiles = [];
  let cleanupFailed = false;
  const command = async (name, args, input, cwd = root) => run(name, args, { env: cleanEnv, input, cwd, signal,
    diagnosticType: name === 'xcrun' && args[0] === 'altool' ? 'transporter' : undefined });
  const plist = async input => JSON.parse(await command('plutil', ['-convert', 'json', '-o', '-', '--', '-'], input));
  try {
    requireTrue((await command('git', ['rev-parse', 'HEAD'])).trim() === config.sha, 'Checked-out source changed.');
    const xcode = await command('xcodebuild', ['-version']);
    requireTrue(Number(/^Xcode (\d+)/m.exec(xcode)?.[1] ?? 0) >= 26, 'Xcode 26 or newer is required.');
    const sdk = await command('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']);
    requireTrue(Number(sdk.trim().split('.')[0]) >= 26, 'iOS 26 SDK or newer is required.');
    stage = 'Apple tool preflight';
    await command('xcrun', ['altool', '--version']);
    stage = 'source verification';
    log('Verifying the reviewed native source before installing signing material.');
    await command('npm', ['run', 'verify']);
    await command('npm', ['run', 'sync']);

    const tempParent = await realpath(env.RUNNER_TEMP);
    temporary = await mkdtemp(path.join(tempParent, 'wovo-signing-'));
    await chmod(temporary, 0o700);
    stage = 'native policy tests';
    const navigationTest = path.join(temporary, 'navigation-tests');
    const downloadTest = path.join(temporary, 'download-tests');
    await command('swiftc', ['ios/App/App/WovoNavigationPolicy.swift', 'tests/navigation-policy-tests.swift', '-o', navigationTest]);
    await command(navigationTest, []);
    await command('swiftc', ['ios/App/App/WovoNavigationPolicy.swift', 'ios/App/App/WovoDownloadPolicy.swift', 'tests/download-policy-tests.swift', '-o', downloadTest]);
    await command(downloadTest, []);
    keychain = path.join(temporary, 'signing.keychain-db');
    const certFile = path.join(temporary, 'distribution.p12');
    const profileFile = path.join(temporary, 'distribution.mobileprovision');
    const keychainPassword = randomBytes(32).toString('hex');
    // GitHub masks both source secrets and our generated keychain password.
    for (const value of [...SECRET_NAMES.map(key => env[key]), keychainPassword]) {
      log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
    }
    await privateWrite(certFile, decodeSecret(env.WOVO_P12_BASE64, 512_000));
    await privateWrite(profileFile, decodeSecret(env.WOVO_PROFILE_BASE64, 1_000_000));
    stage = 'profile verification';
    const profilePayload = await command('security', ['cms', '-D', '-i', profileFile]);
    const profile = JSON.parse(await command('python3', ['-c', PROFILE_JSON_ADAPTER], profilePayload));
    const fingerprints = validateDistributionProfile(profile, config.team);
    stage = 'temporary keychain';
    await command('security', ['create-keychain', '-p', keychainPassword, keychain]);
    await command('security', ['set-keychain-settings', '-lut', '3600', keychain]);
    await command('security', ['unlock-keychain', '-p', keychainPassword, keychain]);
    await command('security', ['import', certFile, '-P', env.WOVO_P12_PASSWORD, '-t', 'cert', '-f', 'pkcs12', '-k', keychain,
      '-T', '/usr/bin/codesign', '-T', '/usr/bin/security']);
    await command('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', keychainPassword, keychain]);
    const fingerprint = matchingIdentity(await command('security', ['find-identity', '-v', '-p', 'codesigning', keychain]), fingerprints);
    previousKeychains = [...(await command('security', ['list-keychains', '-d', 'user'])).matchAll(/"([^"\r\n]+)"/g)].map(match => match[1]);
    requireTrue(previousKeychains.every(file => path.isAbsolute(file)), 'Invalid existing keychain search list.');
    // Record intent first so cleanup also restores after an uncertain command response.
    searchListChanged = true;
    await command('security', ['list-keychains', '-d', 'user', '-s', keychain, ...previousKeychains]);

    for (const location of [['Library', 'MobileDevice', 'Provisioning Profiles'], ['Library', 'Developer', 'Xcode', 'UserData', 'Provisioning Profiles']]) {
      const directory = path.join(runnerHome, ...location);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const target = path.join(directory, `${profile.UUID}.mobileprovision`);
      const sourceBytes = await readFile(profileFile);
      try { await plainFile(target); requireTrue((await readFile(target)).equals(sourceBytes), 'An installed profile with this UUID differs; refusing to overwrite.'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await privateWrite(target, sourceBytes);
        installedProfiles.push({ path: target, hash: createHash('sha256').update(sourceBytes).digest('hex') });
      }
    }
    const optionsFile = path.join(temporary, 'ExportOptions.plist');
    await privateWrite(optionsFile, exportOptions(config, profile.UUID, fingerprint));
    const archive = path.join(temporary, 'WOVO.xcarchive');
    const exported = path.join(temporary, 'export');
    stage = 'signed archive';
    log('Building a manually signed archive. No automatic provisioning is permitted.');
    await command('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release',
      '-destination', 'generic/platform=iOS', '-archivePath', archive,
      `DEVELOPMENT_TEAM=${config.team}`, 'CODE_SIGN_STYLE=Manual', `CODE_SIGN_IDENTITY=${fingerprint}`,
      `PROVISIONING_PROFILE_SPECIFIER=${profile.UUID}`, `CURRENT_PROJECT_VERSION=${config.build}`, `MARKETING_VERSION=${config.version}`,
      `OTHER_CODE_SIGN_FLAGS=--keychain ${keychain}`, 'archive']);
    stage = 'archive identity and signature';
    const appsDirectory = path.join(archive, 'Products', 'Applications');
    const apps = (await readdir(appsDirectory)).filter(name => name.endsWith('.app'));
    requireTrue(apps.length === 1, 'Expected one archived app.');
    const app = path.join(appsDirectory, apps[0]);
    const info = await plist(await readFile(path.join(app, 'Info.plist')));
    requireTrue(info.CFBundleIdentifier === BUNDLE_ID && info.CFBundleVersion === config.build
      && info.CFBundleShortVersionString === config.version, 'Archived app identity or version does not match the approved request.');
    await command('codesign', ['--verify', '--deep', '--strict', app]);
    stage = 'manual export';
    await command('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exported, '-exportOptionsPlist', optionsFile]);
    const ipas = (await readdir(exported)).filter(name => name.endsWith('.ipa'));
    requireTrue(ipas.length === 1, 'Expected one exported IPA.');
    const ipa = path.join(exported, ipas[0]);
    await plainFile(ipa);
    const ipaHash = createHash('sha256').update(await readFile(ipa)).digest('hex');

    stage = 'API key validation';
    const p8 = decodeSecret(env.WOVO_ASC_P8_BASE64, 8192);
    const privateKey = createPrivateKey(p8);
    requireTrue(privateKey.asymmetricKeyType === 'ec' && privateKey.asymmetricKeyDetails?.namedCurve === 'prime256v1', 'An EC P-256 team API private key is required.');
    const keyDirectory = path.join(temporary, 'private_keys');
    await mkdir(keyDirectory, { mode: 0o700 });
    await privateWrite(path.join(keyDirectory, `AuthKey_${config.keyId}.p8`), p8);
    // Only these two explicitly gated altool operations receive the exact private
    // key directory. No global environment change or home-directory key install.
    const appleDelivery = operation => run('xcrun', transportArguments(operation, ipa, config), {
      env: { ...cleanEnv, API_PRIVATE_KEYS_DIR: keyDirectory }, cwd: temporary, signal, diagnosticType: 'transporter',
    });
    stage = 'Apple validation';
    log('Validating the signed IPA with Apple. This does not invite testers or submit App Review.');
    await appleDelivery('verify');
    if (config.operation === 'upload-to-testflight') {
      stage = 'Apple upload (acceptance may be uncertain on interruption)';
      requireTrue(createHash('sha256').update(await readFile(ipa)).digest('hex') === ipaHash, 'The validated IPA changed before upload.');
      log('Uploading the validated build only; no automatic retry, invitations or App Review submission.');
      await appleDelivery('upload');
    }
    log(JSON.stringify({ result: config.operation === 'upload-to-testflight' ? 'upload-command-succeeded-processing-unverified' : 'validation-command-succeeded-no-upload',
      bundleId: BUNDLE_ID, version: config.version, build: config.build, sourceSha: config.sha, ipaSha256: ipaHash }));
    return { operation: config.operation, ipaSha256: ipaHash };
  } catch (error) {
    if (['Apple tool preflight', 'Apple validation', 'Apple upload (acceptance may be uncertain on interruption)'].includes(stage) && error?.transporterDiagnostic) {
      log(JSON.stringify({ event: 'apple-tool-failure', tool: 'altool', ...safeTransporterDiagnostic(error.transporterDiagnostic) }));
    }
    throw new Error(`Native release stopped at ${stage}. Raw credential/tool output is suppressed. If upload started, check App Store Connect before another attempt; acceptance is unconfirmed.`);
  } finally {
    // Fresh hosted runner only. Never delete pre-existing or subsequently changed profiles.
    const clean = async (name, args) => { try { await run(name, args, { env: cleanEnv, cwd: root }); } catch { cleanupFailed = true; } };
    if (searchListChanged) await clean('security', ['list-keychains', '-d', 'user', '-s', ...previousKeychains]);
    if (keychain) {
      try { await plainFile(keychain); await clean('security', ['delete-keychain', keychain]); }
      catch (error) { if (error.code !== 'ENOENT') cleanupFailed = true; }
    }
    for (const installed of installedProfiles) {
      try {
        await plainFile(installed.path);
        requireTrue(createHash('sha256').update(await readFile(installed.path)).digest('hex') === installed.hash, 'Profile changed during run.');
        await unlink(installed.path);
      } catch { cleanupFailed = true; }
    }
    if (temporary) {
      try {
        const parent = await realpath(env.RUNNER_TEMP);
        requireTrue(path.dirname(temporary) === parent && path.basename(temporary).startsWith('wovo-signing-'), 'Unexpected cleanup target.');
        await rm(temporary, { recursive: true, force: true });
      } catch { cleanupFailed = true; }
    }
    if (cleanupFailed) throw new Error('Native signing cleanup was incomplete. Do not retain this hosted runner or publish its files; inspect privately.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  release({ signal: controller.signal }).catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); });
}
