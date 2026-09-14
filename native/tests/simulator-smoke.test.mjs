import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateUdid, selectIphoneTemplate, parseLaunchPid, safeFailureCode, pngDimensions } from '../scripts/simulator-smoke-policy.mjs';

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

test('anonymous launch orchestration is bounded, no generation/auth/permission actions or broad simulator cleanup', async () => {
  const body = await readFile(new URL('../scripts/smoke-simulator.mjs', import.meta.url), 'utf8');
  assert.match(body, /GITHUB_REPOSITORY !== 'wovomedia\/wovo-media'/);
  assert.match(body, /GITHUB_REF !== 'refs\/heads\/wovo-ios-build'/);
  assert.match(body, /process\.platform !== 'darwin'/);
  assert.match(body, /started \+ 360_000/);
  assert.match(body, /\['simctl', 'create', 'WOVO Anonymous Launch Smoke'/);
  assert.match(body, /process\.kill\(launchedPid, 0\)/);
  assert.match(body, /newAppCrashCount/);
  assert.match(body, /\['simctl', 'shutdown', validateUdid\(createdUdid\)\]/);
  assert.doesNotMatch(body, /\['simctl', '(?:erase|delete|privacy|push|openurl)'|signIn\(|fetch\(|\/api\/|Bearer |process\.env\.(?:HOME|FAL|STRIPE|SUPABASE)|shell: true|console\.log\(error/);
  assert.match(body, /screenshotRequiresHumanReview: true/);
  assert.match(body, /authenticationVerified: false, generationVerified: false/);
});
