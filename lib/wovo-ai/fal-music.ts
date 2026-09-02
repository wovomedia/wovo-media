import "server-only";

import { fal } from "@fal-ai/client";
import { quoteMusicTrack, resolveAiModel, type MusicQuality } from "@/lib/ai/provider-models";
import { getEnv } from "@/lib/env";

type FalMusicData = {
  audio?: string | { url?: string; content_type?: string; file_name?: string; file_size?: number };
  audio_file?: { url?: string; content_type?: string; file_name?: string; file_size?: number };
  seed?: number;
};

function configureFal() {
  const credentials = getEnv("FAL_KEY") || getEnv("FAL_API_KEY");
  if (!credentials) throw new Error("FAL_MUSIC_NOT_CONFIGURED");
  fal.config({ credentials });
}

export function getFalMusicModel(quality: MusicQuality) {
  return resolveAiModel(quality === "premium" ? "music.premium" : "music.economy").modelId;
}

export async function createFalMusicJob(input: {
  prompt: string;
  durationSeconds: number;
  quality: MusicQuality;
}) {
  configureFal();
  const maxSeconds = input.quality === "premium" ? 190 : 180;
  const seconds = Math.max(30, Math.min(Math.round(input.durationSeconds), maxSeconds));
  const resolved = resolveAiModel(input.quality === "premium" ? "music.premium" : "music.economy");
  const quote = quoteMusicTrack(input.quality, seconds);
  const submitted = await fal.queue.submit(resolved.modelId, {
    input: input.quality === "premium"
      ? { prompt: input.prompt, seconds_total: seconds, num_inference_steps: 8, guidance_scale: 1 }
      : { prompt: input.prompt, duration: seconds },
  });
  if (!submitted.request_id) throw new Error("FAL_MUSIC_JOB_ID_MISSING");
  return {
    providerJobId: submitted.request_id,
    status: "queued" as const,
    model: resolved.modelId,
    seconds,
    quality: input.quality,
    pricingVersion: resolved.pricingVersion,
    registryVersion: quote.registryVersion,
    estimatedProviderCostMicros: quote.estimatedProviderCostMicros,
    quotedCredits: quote.customerCredits,
  };
}

function resultUrl(data: FalMusicData | null) {
  if (!data) return null;
  if (typeof data.audio === "string") return data.audio;
  return data.audio?.url ?? data.audio_file?.url ?? null;
}

export async function getFalMusicJob(model: string, requestId: string): Promise<{
  status: "queued" | "processing" | "completed" | "failed";
  data: FalMusicData | null;
  remoteUrl: string | null;
}> {
  configureFal();
  const status = await fal.queue.status(model, { requestId, logs: false });
  if (status.status === "COMPLETED") {
    const result = await fal.queue.result(model, { requestId });
    const data = (result.data ?? null) as FalMusicData | null;
    return { status: "completed", data, remoteUrl: resultUrl(data) };
  }
  if (status.status === "IN_QUEUE") return { status: "queued", data: null, remoteUrl: null };
  if (status.status === "IN_PROGRESS") return { status: "processing", data: null, remoteUrl: null };
  return { status: "failed", data: null, remoteUrl: null };
}

export async function downloadFalMusic(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("fal.media")) {
    throw new Error("FAL_MUSIC_RESULT_URL_INVALID");
  }
  const response = await fetch(parsed, { cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("FAL_MUSIC_DOWNLOAD_FAILED");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 80 * 1024 * 1024) throw new Error("FAL_MUSIC_SIZE_INVALID");
  const sample = new Uint8Array(bytes.slice(0, 16));
  const ascii = (start: number, length: number) => String.fromCharCode(...sample.slice(start, start + length));
  const detectedType = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE"
    ? "audio/wav"
    : ascii(0, 3) === "ID3" || (sample[0] === 0xff && (sample[1] & 0xe0) === 0xe0)
      ? "audio/mpeg"
      : ascii(0, 4) === "OggS"
        ? "audio/ogg"
        : ascii(4, 4) === "ftyp"
          ? "audio/mp4"
          : null;
  const providerType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? null;
  // Some provider responses currently label valid WAV output as image/png. Trust
  // recognized audio signatures, never a mismatched provider header by itself.
  const contentType = detectedType ?? (providerType?.startsWith("audio/") ? providerType : null);
  if (!contentType) throw new Error("FAL_MUSIC_CONTENT_TYPE_INVALID");
  return { bytes, contentType };
}
