import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateUdid, selectIphoneTemplate, parseLaunchPid, safeFailureCode, pngDimensions, createdSimulatorState } from '../scripts/simulator-smoke-policy.mjs';
import { runSmokeCommand, sanitizedCommandFailure } from '../scripts/simulator-smoke-command.mjs';

test('smoke selects an available iPhone template on newest supported iOS, never user state', () => {
  const device = (name, type, isAvailable = true) => ({ name, deviceTypeIdentifier: `com.apple.CoreSimulator.SimDeviceType.${type}`, isAvailable });
  const result = selectIphoneTemplate({ devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-18-6': [device('iPhone 16', 'iPhone-16')],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-6': [device('iPad Pro', 'iPad-Pro'), device('iPhone 17', 'iPhone-17'), device('iPhone 18', 'iPhone-18', false)],
    'com.apple.CoreSimulator.SimRuntime.tvOS-27-0': [device('iPhone invalid', 'iPhone-17')],
  } });
  assert.deepEqual(result, { name: 'iPhone 17', runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-26-6', deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17' });
  assert.throws(() => selectIphoneTemplate({ devices: {} }), /SMOKE_NO_AVAILABLE_IPHONE/);
});

test('simulator IDs/PIDs are validated and child error text cannot leak into evidence', () => {
  const id = '12345678-1234-1234-1234-123456789ABC';
  assert.equal(validateUdid(id), id);
  for (const value of ['all', 'booted', '', '../', 'bad; command']) assert.throws(() => validateUdid(value));
  assert.equal(parseLaunchPid('com.wovomedia.wovo: 1243\n'), 1243);
  assert.throws(() => parseLaunchPid('other.bundle: 1243'));
  assert.throws(() => parseLaunchPid('com.wovomedia.wovo: 0'));
  assert.equal(safeFailureCode(new Error('https://example.test?token=private')), 'SMOKE_COMMAND_FAILED');
  assert.equal(safeFailureCode(new Error('SMOKE_APP_NOT_RUNNING')), 'SMOKE_APP_NOT_RUNNING');
});

test('screenshot dimensions are verified without importing or exposing arbitrary media', () => {
  const png = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(1206, 16); png.writeUInt32BE(2622, 20);
  assert.deepEqual(pngDimensions(png), { width: 1206, height: 2622 });
  assert.throws(() => pngDimensions(Buffer.from('not a screenshot')));
  png.writeUInt32BE(0, 16); assert.throws(() => pngDimensions(png));
});

test('command failures retain only a fixed category, bounded numeric status and whitelisted signals', () => {
  const details = sanitizedCommandFailure({ code: 42, signal: 'SIGTERM', stdout: 'private', stderr: 'secret', message: 'secret', cmd: 'secret' },
    { timedOut: false, elapsedMilliseconds: 22.2, limitMilliseconds: 300 });
  assert.deepEqual(details, { kind: 'exit', timedOut: false, exitCode: 42, signal: 'SIGTERM', spawnCode: null, elapsedMilliseconds: 22, limitMilliseconds: 300 });
  const unknown = sanitizedCommandFailure({ code: 'private', signal: 'private' }, { timedOut: false, elapsedMilliseconds: 1, limitMilliseconds: 300 });
  assert.equal(unknown.kind, 'unknown');
  assert.equal(unknown.signal, null);
  assert.equal(unknown.spawnCode, null);
  assert.equal(sanitizedCommandFailure({ code: 'ENOENT' }, { timedOut: false, elapsedMilliseconds: 1, limitMilliseconds: 300 }).kind, 'spawn');
  assert.equal(sanitizedCommandFailure({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, { timedOut: false, elapsedMilliseconds: 1, limitMilliseconds: 300 }).kind, 'output_limit');
});

test('real child exit and timeout are distinguished without returning output or command text', async () => {
  const cwd = process.cwd();
  assert.equal(await runSmokeCommand(process.execPath, ['-e', 'process.stdout.write("ok")'], { cwd, limitMilliseconds: 10_000 }), 'ok');
  await assert.rejects(runSmokeCommand(process.execPath, ['-e', 'console.error("PRIVATE_TOKEN");process.exit(23)'], { cwd, limitMilliseconds: 10_000 }), error => {
    assert.equal(error.message, 'SMOKE_COMMAND_FAILED');
    assert.equal(error.commandFailure.kind, 'exit');
    assert.equal(error.commandFailure.exitCode, 23);
    assert.equal(error.commandFailure.timedOut, false);
    assert.doesNotMatch(JSON.stringify(error), /PRIVATE_TOKEN|stderr|stdout|process\.exit|cause|cmd/);
    return true;
  });
  await assert.rejects(runSmokeCommand(process.execPath, ['-e', 'setTimeout(()=>{},30_000)'], { cwd, limitMilliseconds: 100 }), error => {
    assert.equal(error.message, 'SMOKE_COMMAND_TIMEOUT');
    assert.equal(error.commandFailure.kind, 'timeout');
    assert.equal(error.commandFailure.timedOut, true);
    assert.equal(error.commandFailure.limitMilliseconds, 100);
    assert.equal(error.commandFailure.exitCode, null);
    return true;
  });
});

test('failed boot snapshot exposes only the fresh simulator state and never other device details', () => {
  const id = '12345678-1234-1234-1234-123456789ABC';
  const payload = { devices: { runtime: [
    { udid: 'other-private-device', name: 'private-name', state: 'Booted', isAvailable: true },
    { udid: id.toLowerCase(), name: 'private-name', state: 'Booting', isAvailable: true, availabilityError: 'private' },
  ] } };
  assert.deepEqual(createdSimulatorState(payload, id), { found: true, state: 'Booting', isAvailable: true });
  assert.deepEqual(createdSimulatorState({}, id), { found: false, state: 'Unknown', isAvailable: null });
  assert.deepEqual(createdSimulatorState({ devices: { runtime: [{ udid: id, state: 'private-state', isAvailable: 'private' }] } }, id),
    { found: true, state: 'Unknown', isAvailable: null });
  assert.throws(() => createdSimulatorState(payload, 'all'), /SMOKE_DEVICE_ID_INVALID/);
});

test('anonymous launch orchestration is bounded, no generation/auth/permission actions or broad simulator cleanup', async () => {
  const body = await readFile(new URL('../scripts/smoke-simulator.mjs', import.meta.url), 'utf8');
  assert.match(body, /GITHUB_REPOSITORY !== 'wovomedia\/wovo-media'/);
  assert.match(body, /GITHUB_REF !== 'refs\/heads\/wovo-ios-build'/);
  assert.match(body, /process\.platform !== 'darwin'/);
  assert.match(body, /started \+ 600_000/);
  assert.match(body, /\['simctl', 'bootstatus', createdUdid, '-b'\], 360_000/);
  assert.match(body, /limitMilliseconds: 15_000/);
  assert.match(body, /evidence\.stage === 'boot_fresh_simulator'/);
  assert.match(body, /createdSimulatorState\(devices, createdUdid\)/);
  assert.match(body, /\['simctl', 'create', 'WOVO Anonymous Launch Smoke'/);
  assert.match(body, /process\.kill\(launchedPid, 0\)/);
  assert.match(body, /newAppCrashCount/);
  assert.match(body, /\['simctl', 'shutdown', validateUdid\(createdUdid\)\]/);
  assert.doesNotMatch(body, /\['simctl', '(?:erase|delete|privacy|push|openurl)'|signIn\(|fetch\(|\/api\/|Bearer |process\.env\.(?:HOME|FAL|STRIPE|SUPABASE)|shell: true|console\.log\(error/);
  assert.match(body, /screenshotRequiresHumanReview: true/);
  assert.match(body, /authenticationVerified: false, generationVerified: false/);
});
