import { lstat, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const nativeRoot = fileURLToPath(new URL('../', import.meta.url));
const limits = Object.freeze({
  runtime: Object.freeze({
    maxBytes: 16 * 1024 * 1024,
    optional: true,
    files: Object.freeze(['build/runtime-smoke/anonymous-launch-early.png',
      'build/runtime-smoke/anonymous-launch.png', 'build/runtime-smoke/summary.json']),
  }),
  simulator: Object.freeze({
    maxBytes: 256 * 1024 * 1024,
    optional: false,
    files: Object.freeze(['build/WOVO-Internal-simulator.zip']),
  }),
});

export async function checkArtifactSize(mode, directory = nativeRoot) {
  if (!Object.hasOwn(limits, mode)) throw new Error('ARTIFACT_MODE_INVALID');
  const limit = limits[mode];
  let totalBytes = 0;
  let fileCount = 0;
  // Match the fixed workflow paths exactly, including partial failed-smoke
  // evidence. Never follow a symlink or upload a whole output directory.
  for (const relativePath of limit.files) {
    let metadata;
    try { metadata = await lstat(join(directory, relativePath)); }
    catch (error) {
      if (limit.optional && error.code === 'ENOENT') continue;
      throw new Error('ARTIFACT_FILE_UNAVAILABLE');
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('ARTIFACT_FILE_TYPE_INVALID');
    if (!Number.isSafeInteger(metadata.size) || metadata.size < 0) throw new Error('ARTIFACT_FILE_SIZE_INVALID');
    if (!limit.optional && metadata.size === 0) throw new Error('ARTIFACT_FILE_EMPTY');
    totalBytes += metadata.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > limit.maxBytes) throw new Error('ARTIFACT_SIZE_LIMIT_EXCEEDED');
    fileCount += 1;
  }
  return { mode, fileCount, totalBytes, maximumBytes: limit.maxBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('ARTIFACT_MODE_INVALID');
    const result = await checkArtifactSize(process.argv[2]);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `upload_ready=${result.fileCount > 0}\n`);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
