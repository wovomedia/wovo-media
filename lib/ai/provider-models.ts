export const AI_MODEL_REGISTRY_VERSION = "2026-09-17.1";
export const AI_RETAIL_CREDIT_FLOOR_MICROS = 83_333;
export const AI_MIN_DIRECT_PROVIDER_MARGIN_BPS = 8_000;

export type AiModelKey =
  | "caption.default"
  | "image.default"
  | "video.kling.pro.text"
  | "video.kling.pro.image"
  | "video.seedance.fast.text"
  | "video.seedance.fast.image"
  | "video.seedance.long"
  | "music.economy"
  | "music.premium";

export type AiProvider = "openai" | "fal";
export type AiCapability = "text" | "image" | "video" | "audio";

/** Supported output lengths for a single provider call. Longer requests map up. */
export type VideoDurationSeconds = 5 | 10 | 15 | 30;

type TokenPricing = {
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
};

type OutputPricing = {
  /** Base provider cost estimate for the shortest supported clip (micros USD). */
  estimatedMicrosPerOutput: number;
  /** Optional per-second rate when cost scales with duration (micros USD). */
  microsPerSecond?: number;
  maxDurationSeconds?: VideoDurationSeconds;
  minDurationSeconds?: VideoDurationSeconds;
  audioIncluded: boolean;
};

type ModelDefinition = {
  key: AiModelKey;
  provider: AiProvider;
  capability: AiCapability;
  modelId: string;
  pricingVersion: string;
  tokenPricing?: TokenPricing;
  outputPricing?: OutputPricing;
};

export type ResolvedAiModel = ModelDefinition;

export type GenerationQuote = {
  registryVersion: string;
  workflow: "social_post_image" | "short_video" | "music_track";
  customerCredits: number;
  estimatedProviderCostMicros: number;
  durationSeconds?: number;
  audioEnabled?: boolean;
  models: Array<{
    key: AiModelKey;
    provider: AiProvider;
    modelId: string;
    pricingVersion: string;
  }>;
};

const MODEL_DEFINITIONS: Record<AiModelKey, ModelDefinition> = {
  "caption.default": {
    key: "caption.default",
    provider: "openai",
    capability: "text",
    modelId: "gpt-5.6-luna",
    pricingVersion: "openai-2026-08-30",
    tokenPricing: {
      inputMicrosPerMillionTokens: 200_000,
      outputMicrosPerMillionTokens: 1_200_000,
    },
  },
  "image.default": {
    key: "image.default",
    provider: "fal",
    capability: "image",
    modelId: "fal-ai/flux-2",
    pricingVersion: "fal-flux2-mp-2026-08-30",
    outputPricing: {
      estimatedMicrosPerOutput: 30_000,
      audioIncluded: false,
    },
  },
  // Kling 3.0 Pro — cinematic default. fal: $0.112/s audio off, $0.168/s audio on.
  // WOVO always requests audio for customer video.
  "video.kling.pro.text": {
    key: "video.kling.pro.text",
    provider: "fal",
    capability: "video",
    modelId: "fal-ai/kling-video/v3/pro/text-to-video",
    pricingVersion: "fal-kling3-pro-audio-2026-09-17",
    outputPricing: {
      estimatedMicrosPerOutput: 840_000, // 5s @ $0.168/s
      microsPerSecond: 168_000,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      audioIncluded: true,
    },
  },
  "video.kling.pro.image": {
    key: "video.kling.pro.image",
    provider: "fal",
    capability: "video",
    modelId: "fal-ai/kling-video/v3/pro/image-to-video",
    pricingVersion: "fal-kling3-pro-audio-2026-09-17",
    outputPricing: {
      estimatedMicrosPerOutput: 840_000,
      microsPerSecond: 168_000,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      audioIncluded: true,
    },
  },
  // Seedance 2.0 Fast — strong motion + native audio included (~$0.2419/s at 720p).
  "video.seedance.fast.text": {
    key: "video.seedance.fast.text",
    provider: "fal",
    capability: "video",
    modelId: "bytedance/seedance-2.0/fast/text-to-video",
    pricingVersion: "fal-seedance20-fast-2026-09-17",
    outputPricing: {
      estimatedMicrosPerOutput: 1_210_000, // ~5s
      microsPerSecond: 241_900,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      audioIncluded: true,
    },
  },
  "video.seedance.fast.image": {
    key: "video.seedance.fast.image",
    provider: "fal",
    capability: "video",
    modelId: "bytedance/seedance-2.0/fast/image-to-video",
    pricingVersion: "fal-seedance20-fast-2026-09-17",
    outputPricing: {
      estimatedMicrosPerOutput: 1_210_000,
      microsPerSecond: 241_900,
      minDurationSeconds: 5,
      maxDurationSeconds: 15,
      audioIncluded: true,
    },
  },
  // Seedance 2.5 — single-pass up to ~30s (longer realtor / promo asks).
  // ~$0.473/s at 720p on fal; used when the user asks for 20s+.
  "video.seedance.long": {
    key: "video.seedance.long",
    provider: "fal",
    capability: "video",
    modelId: "bytedance/seedance-2.5/image-to-video",
    pricingVersion: "fal-seedance25-2026-09-17",
    outputPricing: {
      estimatedMicrosPerOutput: 2_365_000, // ~5s baseline
      microsPerSecond: 473_000,
      minDurationSeconds: 5,
      maxDurationSeconds: 30,
      audioIncluded: true,
    },
  },
  "music.economy": {
    key: "music.economy",
    provider: "fal",
    capability: "audio",
    modelId: "cassetteai/music-generator",
    pricingVersion: "fal-cassetteai-output-minute-2026-08-31",
    outputPricing: {
      estimatedMicrosPerOutput: 20_000,
      audioIncluded: true,
    },
  },
  "music.premium": {
    key: "music.premium",
    provider: "fal",
    capability: "audio",
    modelId: "fal-ai/stable-audio-25/text-to-audio",
    pricingVersion: "fal-stable-audio-25-output-2026-08-31",
    outputPricing: {
      estimatedMicrosPerOutput: 200_000,
      audioIncluded: true,
    },
  },
};

export function resolveAiModel(key: AiModelKey): ResolvedAiModel {
  const definition = MODEL_DEFINITIONS[key];
  return {
    key: definition.key,
    provider: definition.provider,
    capability: definition.capability,
    modelId: definition.modelId,
    pricingVersion: definition.pricingVersion,
    tokenPricing: definition.tokenPricing,
    outputPricing: definition.outputPricing,
  };
}

export function estimateTokenCostMicros(
  model: ResolvedAiModel,
  usage: { inputTokens: number; outputTokens: number },
): number {
  if (!model.tokenPricing) return 0;
  const inputTokens = Math.max(0, Math.floor(usage.inputTokens));
  const outputTokens = Math.max(0, Math.floor(usage.outputTokens));
  const inputCost = (inputTokens * model.tokenPricing.inputMicrosPerMillionTokens) / 1_000_000;
  const outputCost = (outputTokens * model.tokenPricing.outputMicrosPerMillionTokens) / 1_000_000;
  return Math.ceil(inputCost + outputCost);
}

function modelSnapshot(model: ResolvedAiModel): GenerationQuote["models"][number] {
  return {
    key: model.key,
    provider: model.provider,
    modelId: model.modelId,
    pricingVersion: model.pricingVersion,
  };
}

export function directProviderMarginBps(quote: Pick<GenerationQuote, "customerCredits" | "estimatedProviderCostMicros">): number {
  const revenueMicros = quote.customerCredits * AI_RETAIL_CREDIT_FLOOR_MICROS;
  if (revenueMicros <= 0) return -1;
  return Math.floor(((revenueMicros - quote.estimatedProviderCostMicros) * 10_000) / revenueMicros);
}

function economicallySafe<T extends GenerationQuote>(quote: T): T {
  if (directProviderMarginBps(quote) < AI_MIN_DIRECT_PROVIDER_MARGIN_BPS) {
    throw new Error(`Unsafe ${quote.workflow} credit quote for the current provider-cost snapshot.`);
  }
  return quote;
}

/** Map a free-form requested length onto a supported clip duration. */
export function normalizeVideoDurationSeconds(requestedSeconds: number | null | undefined): VideoDurationSeconds {
  const n = Math.round(Number(requestedSeconds) || 0);
  if (n <= 0) return 10; // default cinematic clip — not a silent 5s stub
  if (n <= 7) return 5;
  if (n <= 12) return 10;
  if (n <= 20) return 15;
  return 30;
}

/** Parse "30 second", "30s", "half a minute", etc. from natural language. */
export function parseDurationFromPrompt(prompt: string): number | null {
  const text = prompt.toLowerCase();
  const secMatch = text.match(/\b(\d{1,3})\s*(?:s|sec|secs|second|seconds)\b/);
  if (secMatch) return Math.min(120, Math.max(3, Number(secMatch[1])));
  const minMatch = text.match(/\b(\d{1,2})\s*(?:m|min|mins|minute|minutes)\b/);
  if (minMatch) return Math.min(120, Math.max(3, Number(minMatch[1]) * 60));
  if (/\bhalf\s*(?:a\s*)?minute\b/.test(text)) return 30;
  if (/\bone\s*minute\b/.test(text)) return 60;
  return null;
}

function providerCostForDuration(model: ResolvedAiModel, durationSeconds: VideoDurationSeconds): number {
  const pricing = model.outputPricing;
  if (!pricing) return 0;
  if (pricing.microsPerSecond) {
    return Math.ceil(pricing.microsPerSecond * durationSeconds);
  }
  return pricing.estimatedMicrosPerOutput;
}

/**
 * Credits required so revenue at the retail floor keeps >= 80% direct margin.
 * revenue = credits * floor; cost/revenue <= 0.2 ⇒ credits >= cost / (floor * 0.2)
 */
export function creditsForProviderCostMicros(costMicros: number): number {
  const revenueNeeded = costMicros / 0.2;
  return Math.max(1, Math.ceil(revenueNeeded / AI_RETAIL_CREDIT_FLOOR_MICROS));
}

export function quoteSocialPostImage(): GenerationQuote {
  const caption = resolveAiModel("caption.default");
  const image = resolveAiModel("image.default");
  const captionBudgetMicros = estimateTokenCostMicros(caption, {
    inputTokens: 3_000,
    outputTokens: 450,
  });
  return economicallySafe({
    registryVersion: AI_MODEL_REGISTRY_VERSION,
    workflow: "social_post_image",
    customerCredits: 2,
    estimatedProviderCostMicros:
      captionBudgetMicros + (image.outputPricing?.estimatedMicrosPerOutput ?? 0),
    models: [modelSnapshot(caption), modelSnapshot(image)],
  });
}

export type VideoQuoteInput = {
  hasReferenceImage: boolean;
  /** Requested length in seconds (from UI or prompt parse). */
  requestedSeconds?: number | null;
  /** Prefer Seedance when the user wants richer multi-ref / longer motion. */
  preferSeedance?: boolean;
};

/**
 * Quote a video job. Always assumes native audio on.
 * Picks Kling 3.0 Pro for standard cinematic (incl. realtor I2V),
 * Seedance Fast for mid length, Seedance 2.5 when the ask is ~20–30s+.
 */
export function quoteShortVideo(input: VideoQuoteInput | boolean): GenerationQuote {
  const opts: VideoQuoteInput =
    typeof input === "boolean" ? { hasReferenceImage: input } : input;

  const duration = normalizeVideoDurationSeconds(opts.requestedSeconds);

  let key: AiModelKey;
  if (duration >= 30 || (opts.requestedSeconds != null && opts.requestedSeconds > 20)) {
    key = "video.seedance.long";
  } else if (opts.preferSeedance) {
    key = opts.hasReferenceImage ? "video.seedance.fast.image" : "video.seedance.fast.text";
  } else {
    key = opts.hasReferenceImage ? "video.kling.pro.image" : "video.kling.pro.text";
  }

  const model = resolveAiModel(key);
  const maxDur = model.outputPricing?.maxDurationSeconds ?? 15;
  const effectiveDuration = Math.min(duration, maxDur) as VideoDurationSeconds;
  // If user asked for 30s but model max is 15, still bill the effective clip
  // and the UI must disclose the cap (see public catalog helpers).
  const costMicros = providerCostForDuration(model, effectiveDuration);
  const customerCredits = creditsForProviderCostMicros(costMicros);

  return economicallySafe({
    registryVersion: AI_MODEL_REGISTRY_VERSION,
    workflow: "short_video",
    customerCredits,
    estimatedProviderCostMicros: costMicros,
    durationSeconds: effectiveDuration,
    audioEnabled: true,
    models: [modelSnapshot(model)],
  });
}

export type MusicQuality = "economy" | "premium";

export function quoteMusicTrack(quality: MusicQuality, durationSeconds: number): GenerationQuote {
  const normalizedSeconds = Math.max(30, Math.min(Math.round(durationSeconds), quality === "premium" ? 190 : 180));
  const model = resolveAiModel(quality === "premium" ? "music.premium" : "music.economy");
  const outputMicros = model.outputPricing?.estimatedMicrosPerOutput ?? 0;
  const estimatedProviderCostMicros = quality === "premium"
    ? outputMicros
    : Math.ceil(normalizedSeconds / 60) * outputMicros;
  const customerCredits = quality === "premium"
    ? 13
    : Math.max(2, Math.ceil(normalizedSeconds / 60) * 2);
  return economicallySafe({
    registryVersion: AI_MODEL_REGISTRY_VERSION,
    workflow: "music_track",
    customerCredits,
    estimatedProviderCostMicros,
    models: [modelSnapshot(model)],
  });
}
