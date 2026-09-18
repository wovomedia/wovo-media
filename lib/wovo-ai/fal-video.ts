import "server-only";

import { fal } from "@fal-ai/client";
import {
  normalizeVideoDurationSeconds,
  quoteShortVideo,
  resolveAiModel,
  type AiModelKey,
} from "@/lib/ai/provider-models";
import { getEnv } from "@/lib/env";

type FalVideoData = {
  video?: { url?: string; content_type?: string; file_name?: string; file_size?: number };
  prompt?: string;
  seed?: number;
};

function configureFal() {
  const credentials = getEnv("FAL_KEY") || getEnv("FAL_API_KEY");
  if (!credentials) throw new Error("FAL_VIDEO_NOT_CONFIGURED");
  fal.config({ credentials });
}

function resolveVideoModelKey(input: {
  hasReferenceImage: boolean;
  requestedSeconds?: number | null;
  preferSeedance?: boolean;
}): AiModelKey {
  const duration = normalizeVideoDurationSeconds(input.requestedSeconds);
  if (duration >= 30 || (input.requestedSeconds != null && input.requestedSeconds > 20)) {
    return "video.seedance.long";
  }
  if (input.preferSeedance) {
    return input.hasReferenceImage ? "video.seedance.fast.image" : "video.seedance.fast.text";
  }
  return input.hasReferenceImage ? "video.kling.pro.image" : "video.kling.pro.text";
}

export function getFalVideoModel(hasReferenceImage: boolean, requestedSeconds?: number | null) {
  const key = resolveVideoModelKey({ hasReferenceImage, requestedSeconds });
  return resolveAiModel(key).modelId;
}

export async function createFalVideoJob(input: {
  prompt: string;
  durationSeconds?: number;
  inputReferenceImageUrl?: string;
  preferSeedance?: boolean;
}) {
  configureFal();
  const hasReferenceImage = Boolean(input.inputReferenceImageUrl);
  const quote = quoteShortVideo({
    hasReferenceImage,
    requestedSeconds: input.durationSeconds,
    preferSeedance: input.preferSeedance,
  });
  const resolvedModel = resolveAiModel(quote.models[0].key as AiModelKey);
  const model = resolvedModel.modelId;
  const seconds = quote.durationSeconds ?? normalizeVideoDurationSeconds(input.durationSeconds);

  // Kling uses start_image_url + duration string; Seedance uses image_url + duration number-ish.
  // Always request native audio when the endpoint supports it.
  const isKling = model.includes("kling-video");
  const isSeedance = model.includes("seedance");

  let submitted: { request_id?: string };

  if (isKling) {
    const klingInput: Record<string, unknown> = {
      prompt: input.prompt,
      duration: String(seconds),
      generate_audio: true,
      negative_prompt: "blur, distort, low quality, jitter, warped geometry",
    };
    if (input.inputReferenceImageUrl) {
      klingInput.start_image_url = input.inputReferenceImageUrl;
    }
    submitted = await fal.queue.submit(model, { input: klingInput });
  } else if (isSeedance) {
    const seedanceInput: Record<string, unknown> = {
      prompt: input.prompt,
      duration: seconds,
      generate_audio: true,
      aspect_ratio: hasReferenceImage ? "auto" : "9:16",
    };
    if (input.inputReferenceImageUrl) {
      seedanceInput.image_url = input.inputReferenceImageUrl;
    }
    submitted = await fal.queue.submit(model, { input: seedanceInput });
  } else {
    // Defensive fallback — should not run with the current registry.
    const common = {
      prompt: input.prompt,
      resolution: "720p" as const,
      enable_safety_checker: true,
      enable_output_safety_checker: true,
    };
    submitted = input.inputReferenceImageUrl
      ? await fal.queue.submit(model, {
          input: { ...common, image_url: input.inputReferenceImageUrl, aspect_ratio: "auto" as const },
        })
      : await fal.queue.submit(model, {
          input: { ...common, aspect_ratio: "9:16" as const, enable_prompt_expansion: true },
        });
  }

  if (!submitted.request_id) throw new Error("FAL_VIDEO_JOB_ID_MISSING");
  return {
    providerJobId: submitted.request_id,
    status: "queued",
    model,
    seconds,
    audioEnabled: true,
    pricingVersion: resolvedModel.pricingVersion,
    registryVersion: quote.registryVersion,
    estimatedProviderCostMicros: quote.estimatedProviderCostMicros,
    quotedCredits: quote.customerCredits,
  };
}

export async function getFalVideoJob(model: string, requestId: string): Promise<{
  status: "queued" | "processing" | "completed" | "failed";
  data: FalVideoData | null;
}> {
  configureFal();
  const status = await fal.queue.status(model, { requestId, logs: false });
  if (status.status === "COMPLETED") {
    const result = await fal.queue.result(model, { requestId });
    return { status: "completed", data: (result.data ?? null) as FalVideoData | null };
  }
  if (status.status === "IN_QUEUE") return { status: "queued", data: null };
  if (status.status === "IN_PROGRESS") return { status: "processing", data: null };
  return { status: "failed", data: null };
}

export async function downloadFalVideo(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("fal.media")) {
    throw new Error("FAL_VIDEO_RESULT_URL_INVALID");
  }
  const response = await fetch(parsed, { cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("FAL_VIDEO_DOWNLOAD_FAILED");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 100 * 1024 * 1024) throw new Error("FAL_VIDEO_SIZE_INVALID");
  return { bytes, contentType: response.headers.get("content-type") || "video/mp4" };
}
