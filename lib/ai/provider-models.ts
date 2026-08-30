export const AI_MODEL_REGISTRY_VERSION = "2026-08-30.2";
export const AI_RETAIL_CREDIT_FLOOR_MICROS = 83_333;
export const AI_MIN_DIRECT_PROVIDER_MARGIN_BPS = 8_000;

export type AiModelKey =
  | "caption.default"
  | "image.default"
  | "video.text.default"
  | "video.image.default";

export type AiProvider = "openai" | "fal";
export type AiCapability = "text" | "image" | "video";

type TokenPricing = {
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
};

type OutputPricing = {
  estimatedMicrosPerOutput: number;
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
  workflow: "social_post_image" | "short_video";
  customerCredits: number;
  estimatedProviderCostMicros: number;
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
    pricingVersion: "fal-flux2-estimate-2026-08-30",
    outputPricing: {
      // The fal alias can resolve to variants with different per-megapixel prices.
      // This conservative quote remains an estimate until provider billing is reconciled.
      estimatedMicrosPerOutput: 50_000,
    },
  },
  "video.text.default": {
    key: "video.text.default",
    provider: "fal",
    capability: "video",
    modelId: "fal-ai/wan/v2.2-a14b/text-to-video/turbo",
    pricingVersion: "fal-wan22-720p-2026-08-30",
    outputPricing: {
      estimatedMicrosPerOutput: 100_000,
    },
  },
  "video.image.default": {
    key: "video.image.default",
    provider: "fal",
    capability: "video",
    modelId: "fal-ai/wan/v2.2-a14b/image-to-video/turbo",
    pricingVersion: "fal-wan22-720p-2026-08-30",
    outputPricing: {
      estimatedMicrosPerOutput: 100_000,
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
    customerCredits: 4,
    estimatedProviderCostMicros:
      captionBudgetMicros + (image.outputPricing?.estimatedMicrosPerOutput ?? 0),
    models: [modelSnapshot(caption), modelSnapshot(image)],
  });
}

export function quoteShortVideo(hasReferenceImage: boolean): GenerationQuote {
  const model = resolveAiModel(hasReferenceImage ? "video.image.default" : "video.text.default");
  return economicallySafe({
    registryVersion: AI_MODEL_REGISTRY_VERSION,
    workflow: "short_video",
    customerCredits: 35,
    estimatedProviderCostMicros: model.outputPricing?.estimatedMicrosPerOutput ?? 0,
    models: [modelSnapshot(model)],
  });
}
