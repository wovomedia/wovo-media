export const WOVO_BUNDLE_ID = 'com.wovomedia.wovo';

const udidPattern = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i;
export function validateUdid(value) {
  if (typeof value !== 'string' || !udidPattern.test(value)) throw new Error('SMOKE_DEVICE_ID_INVALID');
  return value;
}

export function selectIphoneTemplate(payload) {
  const candidates = Object.entries(payload.devices ?? {}).flatMap(([runtime, devices]) => {
    if (!/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-\d+(?:-\d+)*$/.test(runtime) || !Array.isArray(devices)) return [];
    return devices.filter(device => device.isAvailable === true && /^iPhone\b/.test(device.name ?? '')
      && /^com\.apple\.CoreSimulator\.SimDeviceType\.iPhone-[A-Za-z0-9-]+$/.test(device.deviceTypeIdentifier ?? ''))
      .map(device => ({ runtime, deviceTypeIdentifier: device.deviceTypeIdentifier, name: device.name }));
  });
  candidates.sort((a, b) => b.runtime.localeCompare(a.runtime, 'en', { numeric: true }) || a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!candidates.length) throw new Error('SMOKE_NO_AVAILABLE_IPHONE');
  return candidates[0];
}

export function parseLaunchPid(output) {
  const match = /^com\.wovomedia\.wovo:\s*(\d+)\s*$/m.exec(output);
  const pid = Number(match?.[1] ?? 0);
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error('SMOKE_LAUNCH_PID_MISSING');
  return pid;
}

export function safeFailureCode(error) {
  return typeof error?.message === 'string' && /^SMOKE_[A-Z_]+$/.test(error.message)
    ? error.message : 'SMOKE_COMMAND_FAILED';
}

export function pngDimensions(bytes) {
  if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('SMOKE_SCREENSHOT_INVALID');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 300 || height < 500 || width > 5000 || height > 5000) throw new Error('SMOKE_SCREENSHOT_INVALID');
  return { width, height };
}
