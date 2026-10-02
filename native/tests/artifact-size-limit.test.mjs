import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, truncate, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { checkArtifactSize } from '../scripts/artifact-size-limit.mjs';

async function fixture(callback) {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'wovo-artifact-budget-'));
  try {
    await mkdir(join(directory, 'build/runtime-smoke'), { recursive: true });
    await callback(directory);
  } finally {
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.match(basename(directory), /^wovo-artifact-budget-/);
    await rm(directory, { recursive: true, force: true });
  }
}

test('runtime evidence can be partial after a failed smoke and is capped in aggregate', async () => fixture(async directory => {
  const early = join(directory, 'build/runtime-smoke/anonymous-launch-early.png');
  const final = join(directory, 'build/runtime-smoke/anonymous-launch.png');
  assert.equal((await checkArtifactSize('runtime', directory)).fileCount, 0);
  await writeFile(early, '');
  await truncate(early, 8 * 1024 * 1024);
  assert.equal((await checkArtifactSize('runtime', directory)).fileCount, 1);
  await writeFile(final, '');
  await truncate(final, 8 * 1024 * 1024);
  assert.equal((await checkArtifactSize('runtime', directory)).totalBytes, 16 * 1024 * 1024);
  await writeFile(join(directory, 'build/runtime-smoke/summary.json'), 'x');
  await assert.rejects(checkArtifactSize('runtime', directory), /ARTIFACT_SIZE_LIMIT_EXCEEDED/);
}));

test('simulator ZIP is required and rejects one byte above the 256 MiB cap', async () => fixture(async directory => {
  const path = join(directory, 'build/WOVO-Internal-simulator.zip');
  await assert.rejects(checkArtifactSize('simulator', directory), /ARTIFACT_FILE_UNAVAILABLE/);
  await writeFile(path, '');
  await assert.rejects(checkArtifactSize('simulator', directory), /ARTIFACT_FILE_EMPTY/);
  await truncate(path, 256 * 1024 * 1024);
  assert.equal((await checkArtifactSize('simulator', directory)).totalBytes, 256 * 1024 * 1024);
  await truncate(path, 256 * 1024 * 1024 + 1);
  await assert.rejects(checkArtifactSize('simulator', directory), /ARTIFACT_SIZE_LIMIT_EXCEEDED/);
}));

test('artifact paths cannot be directories', async () => fixture(async directory => {
  await mkdir(join(directory, 'build/runtime-smoke/summary.json'));
  await assert.rejects(checkArtifactSize('runtime', directory), /ARTIFACT_FILE_TYPE_INVALID/);
}));

test('artifact paths cannot be symlinks', async () => fixture(async directory => {
  const target = join(directory, 'target');
  await mkdir(target);
  await symlink(target, join(directory, 'build/runtime-smoke/summary.json'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkArtifactSize('runtime', directory), /ARTIFACT_FILE_TYPE_INVALID/);
}));

test('unrecognized modes cannot widen the fixed upload paths or budget', async () => fixture(async directory => {
  for (const mode of ['', '../', 'all', 'constructor', '__proto__'])
    await assert.rejects(checkArtifactSize(mode, directory), /ARTIFACT_MODE_INVALID/);
}));
