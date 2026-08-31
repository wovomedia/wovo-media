import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_MODEL_REGISTRY_VERSION,
  AI_MIN_DIRECT_PROVIDER_MARGIN_BPS,
  directProviderMarginBps,
  estimateTokenCostMicros,
  quoteShortVideo,
  quoteMusicTrack,
  quoteSocialPostImage,
  resolveAiModel,
} from "../lib/ai/provider-models.ts";

test("caption pricing produces the audited token-cost estimate", () => {
  const model = resolveAiModel("caption.default");
  assert.equal(model.modelId, "gpt-5.6-luna");
  assert.equal(
    estimateTokenCostMicros(model, { inputTokens: 1_000, outputTokens: 400 }),
    680,
  );
});

test("music quotes preserve the provider-cost margin for economy and premium models", () => {
  const economy = quoteMusicTrack("economy", 120);
  const premium = quoteMusicTrack("premium", 120);
  assert.equal(economy.workflow, "music_track");
  assert.equal(economy.customerCredits, 4);
  assert.equal(economy.estimatedProviderCostMicros, 40_000);
  assert.equal(premium.customerCredits, 13);
  assert.equal(premium.estimatedProviderCostMicros, 200_000);
  assert.ok(directProviderMarginBps(economy) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
  assert.ok(directProviderMarginBps(premium) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
});

test("social post quote snapshots both models and customer credits", () => {
  const quote = quoteSocialPostImage();
  assert.equal(quote.registryVersion, AI_MODEL_REGISTRY_VERSION);
  assert.equal(quote.workflow, "social_post_image");
  assert.equal(quote.customerCredits, 2);
  assert.ok(quote.estimatedProviderCostMicros > 30_000);
  assert.deepEqual(quote.models.map((model) => model.key), ["caption.default", "image.default"]);
});

test("short-video quote records the correct fal workflow", () => {
  const textQuote = quoteShortVideo(false);
  const imageQuote = quoteShortVideo(true);
  assert.equal(textQuote.customerCredits, 12);
  assert.equal(textQuote.estimatedProviderCostMicros, 100_000);
  assert.equal(textQuote.models[0]?.key, "video.text.default");
  assert.equal(imageQuote.models[0]?.key, "video.image.default");
});

test("starter image and premium video quotes clear the direct-provider margin floor", () => {
  const image = quoteSocialPostImage();
  const video = quoteShortVideo(false);
  assert.ok(image.customerCredits <= 10, "starter credits must cover at least one image workflow");
  assert.ok(video.customerCredits > 10, "starter credits must not imply a free premium video");
  assert.ok(directProviderMarginBps(image) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
  assert.ok(directProviderMarginBps(video) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
});

test("legacy generic model overrides cannot bypass the priced registry", () => {
  const previous = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = "unpriced-provider/model";
  try {
    const model = resolveAiModel("caption.default");
    assert.equal(model.modelId, "gpt-5.6-luna");
    assert.equal(model.pricingVersion, "openai-2026-08-30");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previous;
  }
});
