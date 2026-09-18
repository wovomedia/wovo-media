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

test("short-video quote uses Kling 3.0 with audio and duration-aware credits", () => {
  const textQuote = quoteShortVideo({ hasReferenceImage: false, requestedSeconds: 10 });
  const imageQuote = quoteShortVideo({ hasReferenceImage: true, requestedSeconds: 10 });
  assert.equal(textQuote.models[0]?.key, "video.kling.pro.text");
  assert.equal(imageQuote.models[0]?.key, "video.kling.pro.image");
  assert.equal(textQuote.audioEnabled, true);
  assert.equal(textQuote.durationSeconds, 10);
  assert.ok(textQuote.customerCredits >= 100, "10s Kling with audio must not be underpriced");
  assert.ok(directProviderMarginBps(textQuote) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
});

test("long video requests route to Seedance 2.5 and charge more than short clips", () => {
  const shortClip = quoteShortVideo({ hasReferenceImage: true, requestedSeconds: 10 });
  const longClip = quoteShortVideo({ hasReferenceImage: true, requestedSeconds: 30 });
  assert.equal(longClip.models[0]?.key, "video.seedance.long");
  assert.equal(longClip.durationSeconds, 30);
  assert.ok(longClip.customerCredits > shortClip.customerCredits);
  assert.ok(directProviderMarginBps(longClip) >= AI_MIN_DIRECT_PROVIDER_MARGIN_BPS);
});

test("starter image and premium video quotes clear the direct-provider margin floor", () => {
  const image = quoteSocialPostImage();
  const video = quoteShortVideo({ hasReferenceImage: false, requestedSeconds: 10 });
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
