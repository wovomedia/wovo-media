import "server-only";

import { fal } from "@fal-ai/client";
import { resolveAiModel } from "@/lib/ai/provider-models";
import { getEnv } from "@/lib/env";

type FalImageResult = {
  images?: Array<{ url?: string; content_type?: string; width?: number; height?: number }>;
  has_nsfw_concepts?: boolean[];
};

function configureFal() {
  const credentials = getEnv("FAL_KEY") || getEnv("FAL_API_KEY");
  if (!credentials) throw new Error("FAL_IMAGE_NOT_CONFIGURED");
  fal.config({ credentials });
}

export async function generateFalImage(prompt: string, aspect: string) {
  configureFal();
  const model = resolveAiModel("image.default");
  const imageSize = aspect === "9:16" ? "portrait_16_9" : aspect === "16:9" ? "landscape_16_9" : "square_hd";
  const result = await fal.subscribe(model.modelId, {
    input: {
      prompt,
      image_size: imageSize,
      num_images: 1,
      acceleration: "regular",
      enable_safety_checker: true,
      enable_prompt_expansion: true,
      output_format: "png",
    },
    logs: false,
  });
  const data = result.data as FalImageResult;
  if (data.has_nsfw_concepts?.[0]) throw new Error("FAL_IMAGE_SAFETY_BLOCK");
  const image = data.images?.[0];
  if (!image?.url) throw new Error("FAL_IMAGE_RESULT_MISSING");
  return {
    url: image.url,
    contentType: image.content_type || "image/png",
    requestId: result.requestId,
    model: model.modelId,
    pricingVersion: model.pricingVersion,
    estimatedProviderCostMicros: model.outputPricing?.estimatedMicrosPerOutput ?? 0,
  };
}

export async function downloadFalImage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("FAL_IMAGE_RESULT_URL_INVALID");
  const response = await fetch(parsed, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error("FAL_IMAGE_DOWNLOAD_FAILED");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new Error("FAL_IMAGE_SIZE_INVALID");
  return { bytes, contentType: response.headers.get("content-type") || "image/png" };
}
