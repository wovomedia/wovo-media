import { normalizeActionType, type PromptActionType } from "@/lib/wovo-ai/usage";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitBuckets = {
  all: number[];
  imageHeavy: number[];
};

const ROLLING_WINDOW_MS = 10 * 60 * 1000;
const MAX_GENERAL_REQUESTS = 10;
const MAX_IMAGE_HEAVY_REQUESTS = 5;

const inMemoryLimitStore = new Map<string, RateLimitBuckets>();

function now(): number {
  return Date.now();
}

function pruneOld(timestamps: number[], currentTime: number): number[] {
  return timestamps.filter((value) => currentTime - value <= ROLLING_WINDOW_MS);
}

function getOrCreateBuckets(userId: string): RateLimitBuckets {
  const existing = inMemoryLimitStore.get(userId);
  if (existing) return existing;

  const created: RateLimitBuckets = { all: [], imageHeavy: [] };
  inMemoryLimitStore.set(userId, created);
  return created;
}

export function checkAiRateLimit(userId: string, actionType: string): RateLimitResult {
  const normalizedAction = normalizeActionType(actionType);
  const currentTime = now();
  const buckets = getOrCreateBuckets(userId);

  buckets.all = pruneOld(buckets.all, currentTime);
  buckets.imageHeavy = pruneOld(buckets.imageHeavy, currentTime);

  if (buckets.all.length >= MAX_GENERAL_REQUESTS) {
    const retryAfterMs = ROLLING_WINDOW_MS - (currentTime - buckets.all[0]);
    return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(retryAfterMs, 1000) / 1000) };
  }

  const isImageHeavy = normalizedAction === "image" || normalizedAction === "caption_image";
  if (isImageHeavy && buckets.imageHeavy.length >= MAX_IMAGE_HEAVY_REQUESTS) {
    const retryAfterMs = ROLLING_WINDOW_MS - (currentTime - buckets.imageHeavy[0]);
    return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(retryAfterMs, 1000) / 1000) };
  }

  buckets.all.push(currentTime);
  if (isImageHeavy) {
    buckets.imageHeavy.push(currentTime);
  }

  inMemoryLimitStore.set(userId, buckets);
  return { allowed: true, retryAfterSeconds: 0 };
}
