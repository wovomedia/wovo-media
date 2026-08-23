import "server-only";

import { fal } from "@fal-ai/client";
import { getEnv } from "@/lib/env";

const TEXT_MODEL = "fal-ai/longcat-video/text-to-video/720p";
const IMAGE_MODEL = "fal-ai/longcat-video/image-to-video/720p";

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

function secondsToFrames(seconds?: number) {
  const requested = Number.isFinite(seconds) ? Math.round(Number(seconds)) : 6;
  const bounded = Math.max(4, Math.min(requested, 10));
  return { seconds: bounded, frames: bounded * 30 };
}

export function getFalVideoModel(hasReferenceImage: boolean) {
  return hasReferenceImage ? IMAGE_MODEL : TEXT_MODEL;
}

export async function createFalVideoJob(input: {
  prompt: string;
  durationSeconds?: number;
  inputReferenceImageUrl?: string;
}) {
  configureFal();
  const timing = secondsToFrames(input.durationSeconds);
  const model = getFalVideoModel(Boolean(input.inputReferenceImageUrl));
  const common = {
    prompt: input.prompt,
    num_frames: timing.frames,
    fps: 30,
    enable_prompt_expansion: true,
    enable_safety_checker: true,
    video_output_type: "X264 (.mp4)" as const,
    video_quality: "high" as const,
    video_write_mode: "balanced" as const,
    acceleration: "regular" as const,
  };
  const submitted = input.inputReferenceImageUrl
    ? await fal.queue.submit(IMAGE_MODEL, { input: { ...common, image_url: input.inputReferenceImageUrl } })
    : await fal.queue.submit(TEXT_MODEL, { input: { ...common, aspect_ratio: "9:16" as const } });
  if (!submitted.request_id) throw new Error("FAL_VIDEO_JOB_ID_MISSING");
  return { providerJobId: submitted.request_id, status: "queued", model, seconds: timing.seconds };
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
