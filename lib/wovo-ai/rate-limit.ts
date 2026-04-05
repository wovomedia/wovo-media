import { normalizeActionType } from "@/lib/wovo-ai/usage";

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
type Buckets = { all: number[]; imageHeavy: number[] };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_GENERAL = 10;
const MAX_IMAGE   = 5;
const store = new Map<string, Buckets>();

function prune(ts: number[], now: number) { return ts.filter((t) => now - t <= WINDOW_MS); }
function getOrCreate(userId: string): Buckets {
  const e = store.get(userId);
  if (e) return e;
  const b: Buckets = { all: [], imageHeavy: [] };
  store.set(userId, b);
  return b;
}

export function checkAiRateLimit(userId: string, actionType: string): RateLimitResult {
  const action = normalizeActionType(actionType);
  const now = Date.now();
  const b = getOrCreate(userId);
  b.all = prune(b.all, now);
  b.imageHeavy = prune(b.imageHeavy, now);
  if (b.all.length >= MAX_GENERAL) {
    return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(WINDOW_MS - (now - b.all[0]), 1000) / 1000) };
  }
  const isImg = action === "image" || action === "caption_image";
  if (isImg && b.imageHeavy.length >= MAX_IMAGE) {
    return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(WINDOW_MS - (now - b.imageHeavy[0]), 1000) / 1000) };
  }
  b.all.push(now);
  if (isImg) b.imageHeavy.push(now);
  store.set(userId, b);
  return { allowed: true, retryAfterSeconds: 0 };
}
