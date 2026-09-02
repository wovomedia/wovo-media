// Customer-facing error text. Provider identities, endpoints, credentials and
// stack frames must never reach a customer, so anything carrying them is
// replaced wholesale with a curated fallback rather than trimmed.
//
// Deliberately free of imports so the test runner can exercise it directly.

const INTERNAL_MARKERS =
  /(fal\.ai|fal-ai|fal\.run|openai|api\.openai|anthropic|heygen|cassetteai|stability|replicate|elevenlabs|supabase|postgres|stripe|sk-[A-Za-z0-9]|bearer\s|api[_-]?key|authorization|x-api|rate ?limit exceeded for)/i;

const LOOKS_LIKE_URL = /https?:\/\//i;
const LOOKS_LIKE_STACK = /\bat\s+\S+\s*\(/;

/** The message to show a customer, or the fallback when the real one is unsafe. */
export function customerSafeMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (!raw) return fallback;
  if (raw.length > 160) return fallback;
  if (INTERNAL_MARKERS.test(raw)) return fallback;
  if (LOOKS_LIKE_URL.test(raw)) return fallback;
  if (LOOKS_LIKE_STACK.test(raw)) return fallback;
  return raw;
}

/** A short screaming-snake code safe to put in server logs. */
export function internalErrorCode(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  const first = raw.split(/[:\n]/)[0]?.trim() ?? "";
  return /^[A-Z0-9_]{3,60}$/.test(first) ? first : fallback;
}
