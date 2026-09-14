// Run only in the authorized fresh macOS CI job. No account, UI taps, permission
// grants, provider requests, generation, deep links, upload or signing operations.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { WOVO_BUNDLE_ID, validateUdid, selectIphoneTemplate, parseLaunchPid, safeFailureCode, pngDimensions } from './simulator-smoke-policy.mjs';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = join(root, 'build', 'runtime-smoke');
const app = join(root, 'build', 'simulator', 'Build', 'Products', 'Debug-iphonesimulator', 'App.app');
const started = Date.now();
const overallDeadline = started + 360_000;
let createdUdid;
let launchedPid;
const evidence = {
  status: 'running', scope: 'Fresh anonymous iPhone simulator; launch only; no sign-in or generation.',
  signedDeviceBuild: false, authenticationVerified: false, generationVerified: false,
  screenshotRequiresHumanReview: true,
};
const wait = (milliseconds) => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));

async function command(executable, args, limit = 30_000) {
  const remaining = overallDeadline - Date.now();
  if (remaining <= 0) throw new Error('SMOKE_DEADLINE_EXCEEDED');
  const result = await execute(executable, args, {
    cwd: root, shell: false, timeout: Math.min(limit, remaining), killSignal: 'SIGTERM',
    maxBuffer: 2 * 1024 * 1024, encoding: 'utf8',
  });
  return result.stdout;
}

async function ensureAppAlive() {
  if (!launchedPid) throw new Error('SMOKE_APP_NOT_RUNNING');
  try { process.kill(launchedPid, 0); } catch { throw new Error('SMOKE_APP_NOT_RUNNING'); }
  const executable = (await command('/bin/ps', ['-p', String(launchedPid), '-o', 'comm='])).trim();
  if (!executable.endsWith('/App.app/App') && executable !== 'App') throw new Error('SMOKE_APP_PROCESS_CHANGED');
}

async function screenshot(filename) {
  const path = join(outputDirectory, filename);
  await command('xcrun', ['simctl', 'io', createdUdid, 'screenshot', '--type=png', path]);
  return pngDimensions(await readFile(path));
}

async function newAppCrashCount() {
  const directory = join(homedir(), 'Library', 'Logs', 'DiagnosticReports');
  let names;
  try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  let count = 0;
  for (const name of names.filter(name => /^App[-_].*\.(?:ips|crash)$/.test(name))) {
    const metadata = await stat(join(directory, name));
    if (metadata.isFile() && metadata.mtimeMs >= started) count += 1;
  }
  return count;
}

await mkdir(outputDirectory, { recursive: true });
try {
  if (process.platform !== 'darwin' || process.env.CI !== 'true') throw new Error('SMOKE_REQUIRES_MAC_CI');
  if (process.env.GITHUB_REPOSITORY !== 'wovomedia/wovo-media' || process.env.GITHUB_REF !== 'refs/heads/wovo-ios-build') throw new Error('SMOKE_REPOSITORY_NOT_AUTHORIZED');
  evidence.stage = 'select_fresh_simulator';
  if (!(await stat(app)).isDirectory()) throw new Error('SMOKE_COMPILED_APP_MISSING');
  const template = selectIphoneTemplate(JSON.parse(await command('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])));
  evidence.deviceName = template.name;
  evidence.runtime = template.runtime;
  // CREATE, never erase or reuse an existing simulator with another person's state.
  createdUdid = validateUdid((await command('xcrun', ['simctl', 'create', 'WOVO Anonymous Launch Smoke', template.deviceTypeIdentifier, template.runtime])).trim());
  evidence.freshSimulatorCreated = true;
  evidence.stage = 'boot_fresh_simulator';
  await command('xcrun', ['simctl', 'boot', createdUdid]);
  await command('xcrun', ['simctl', 'bootstatus', createdUdid, '-b'], 150_000);
  evidence.stage = 'install_compiled_app';
  await command('xcrun', ['simctl', 'install', createdUdid, app], 60_000);
  evidence.stage = 'compile_screenshot_recognizer';
  await command('swiftc', ['-parse-as-library', 'tests/recognize-studio.swift', '-o', join(outputDirectory, 'recognize-studio')], 60_000);
  evidence.stage = 'launch_anonymous_app';
  launchedPid = parseLaunchPid(await command('xcrun', ['simctl', 'launch', createdUdid, WOVO_BUNDLE_ID], 45_000));
  evidence.launched = true;
  const observationStart = Date.now();
  evidence.stage = 'observe_anonymous_app';
  await wait(12_000);
  await ensureAppAlive();
  evidence.earlyScreenshot = await screenshot('anonymous-launch-early.png');
  await wait(18_000);
  await ensureAppAlive();
  evidence.finalScreenshot = await screenshot('anonymous-launch.png');
  evidence.observedAliveMilliseconds = Date.now() - observationStart;
  evidence.appProcessStillRunning = true;
  evidence.newMatchingCrashReports = await newAppCrashCount();
  if (evidence.newMatchingCrashReports !== 0) throw new Error('SMOKE_NEW_APP_CRASH_REPORT');
  evidence.stage = 'recognize_public_studio';
  const recognition = JSON.parse(await command(join(outputDirectory, 'recognize-studio'), [join(outputDirectory, 'anonymous-launch.png')], 45_000));
  // Strict booleans only. Do not echo raw OCR or arbitrary child process output.
  evidence.publicStudioDetected = recognition.publicStudioDetected === true;
  evidence.offlineMessageDetected = recognition.hasOfflineMessage === true;
  evidence.visualSignals = Object.fromEntries(['hasBrand', 'hasSignIn', 'hasComposer', 'hasCreate'].map(key => [key, recognition[key] === true]));
  evidence.status = evidence.publicStudioDetected ? 'anonymous_studio_detected' : 'visual_review_required';
  evidence.stage = 'complete';
  if (!evidence.publicStudioDetected) process.exitCode = 1;
} catch (error) {
  evidence.status = 'failed';
  evidence.failureCode = safeFailureCode(error);
  process.exitCode = 1;
} finally {
  evidence.elapsedMilliseconds = Date.now() - started;
  await writeFile(join(outputDirectory, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  if (createdUdid) {
    // Only this script's new simulator, never "all" or a user-existing device.
    try { await execute('xcrun', ['simctl', 'shutdown', validateUdid(createdUdid)], { cwd: root, shell: false, timeout: 30_000, maxBuffer: 64 * 1024 }); }
    catch { console.log('Smoke simulator shutdown did not finish; the ephemeral runner will be disposed.'); }
  }
}
