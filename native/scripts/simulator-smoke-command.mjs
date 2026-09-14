import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const allowedSignals = new Set(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGSEGV', 'SIGBUS']);
const allowedSpawnCodes = new Set(['ENOENT', 'EACCES', 'ENOEXEC', 'EAGAIN', 'ENOMEM']);

export function sanitizedCommandFailure(error, { timedOut, elapsedMilliseconds, limitMilliseconds }) {
  const exitCode = Number.isInteger(error?.code) && error.code >= 0 && error.code <= 255 ? error.code : null;
  const signal = allowedSignals.has(error?.signal) ? error.signal : null;
  const spawnCode = allowedSpawnCodes.has(error?.code) ? error.code : null;
  const outputLimit = error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
  return {
    kind: timedOut ? 'timeout' : outputLimit ? 'output_limit' : exitCode !== null ? 'exit' : spawnCode ? 'spawn' : 'unknown',
    timedOut: timedOut === true, exitCode, signal, spawnCode,
    elapsedMilliseconds: Math.max(0, Math.round(elapsedMilliseconds)),
    limitMilliseconds,
  };
}

// Never attach argv, cwd, stdout, stderr, raw errors or causes to public evidence.
// An explicit timer marks actual deadline expiration, rather than guessing from
// SIGTERM (which can also mean an unrelated child failure).
export async function runSmokeCommand(executable, args, { cwd, limitMilliseconds }) {
  if (!Number.isSafeInteger(limitMilliseconds) || limitMilliseconds < 1 || limitMilliseconds > 600_000) {
    throw new Error('SMOKE_COMMAND_LIMIT_INVALID');
  }
  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, limitMilliseconds);
  try {
    const result = await execute(executable, args, {
      cwd, shell: false, signal: controller.signal, killSignal: 'SIGTERM',
      maxBuffer: 2 * 1024 * 1024, encoding: 'utf8',
    });
    return result.stdout;
  } catch (error) {
    const failure = new Error(timedOut ? 'SMOKE_COMMAND_TIMEOUT' : 'SMOKE_COMMAND_FAILED');
    failure.commandFailure = sanitizedCommandFailure(error, {
      timedOut, elapsedMilliseconds: Date.now() - started, limitMilliseconds,
    });
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}
