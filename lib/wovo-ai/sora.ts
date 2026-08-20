import { getEnv } from "@/lib/env";

type SoraCreatePayload = {
  prompt: string;
  model: string;
  seconds: string;
  size: string;
  input_reference?: {
    image_url: string;
  };
};

type SoraVideoResponse = {
  id?: string;
  status?: string;
  progress?: number;
  seconds?: string;
  size?: string;
  error?: { message?: string };
  [key: string]: unknown;
};

function getOpenAiKey(): string {
  const key = getEnv("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

function getSoraBaseUrl(): string {
  return (getEnv("SORA_API_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
}

export function getSoraModel(): string {
  return getEnv("SORA_MODEL") || "sora-2";
}

function getSoraSize(): string {
  return getEnv("SORA_SIZE") || "720x1280";
}

function normalizeSeconds(seconds?: number): string {
  // The current Videos API accepts 4, 8, or 12 second generations only.
  // Keep this server-side so a stale client cannot submit an unsupported or
  // unexpectedly expensive duration.
  const allowed = [4, 8, 12];
  const requested = Number.isFinite(seconds) ? Number(seconds) : 8;
  const selected = allowed.reduce((closest, candidate) => {
    return Math.abs(candidate - requested) < Math.abs(closest - requested) ? candidate : closest;
  }, 8);
  return String(selected);
}

export async function createSoraJob(params: {
  prompt: string;
  durationSeconds?: number;
  inputReferenceImageUrl?: string;
}): Promise<{ providerJobId: string; status: string; raw: SoraVideoResponse }> {
  const payload: SoraCreatePayload = {
    prompt: params.prompt,
    model: getSoraModel(),
    size: getSoraSize(),
    seconds: normalizeSeconds(params.durationSeconds),
  };

  if (params.inputReferenceImageUrl?.trim()) {
    payload.input_reference = {
      image_url: params.inputReferenceImageUrl.trim(),
    };
  }

  const response = await fetch(`${getSoraBaseUrl()}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiKey()}`,
    },
    body: JSON.stringify({
      model: payload.model,
      prompt: payload.prompt,
      size: payload.size,
      seconds: payload.seconds,
      ...(payload.input_reference ? { input_reference: payload.input_reference } : {}),
    }),
    cache: "no-store",
  });

  const raw = (await response.json().catch(() => ({}))) as SoraVideoResponse;
  if (!response.ok) {
    const message = raw.error?.message || "Sora create job request failed.";
    throw new Error(message);
  }

  const providerJobId = String(raw.id ?? "").trim();
  if (!providerJobId) {
    throw new Error("Sora did not return a job id.");
  }

  return {
    providerJobId,
    status: String(raw.status ?? "queued"),
    raw,
  };
}

export async function createSoraEditJob(params: {
  prompt: string;
  sourceProviderVideoId: string;
}): Promise<{ providerJobId: string; status: string; raw: SoraVideoResponse }> {
  const response = await fetch(`${getSoraBaseUrl()}/videos/edits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiKey()}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      video: {
        id: params.sourceProviderVideoId,
      },
    }),
    cache: "no-store",
  });

  const raw = (await response.json().catch(() => ({}))) as SoraVideoResponse;
  if (!response.ok) {
    const message = raw.error?.message || "Sora edit video request failed.";
    throw new Error(message);
  }

  const providerJobId = String(raw.id ?? "").trim();
  if (!providerJobId) {
    throw new Error("Sora edit job did not return a job id.");
  }

  return {
    providerJobId,
    status: String(raw.status ?? "queued"),
    raw,
  };
}

export async function getSoraJobStatus(providerJobId: string): Promise<{
  status: string;
  raw: SoraVideoResponse;
}> {
  const response = await fetch(`${getSoraBaseUrl()}/videos/${encodeURIComponent(providerJobId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
    },
    cache: "no-store",
  });

  const raw = (await response.json().catch(() => ({}))) as SoraVideoResponse;
  if (!response.ok) {
    const message = raw.error?.message || "Sora status request failed.";
    throw new Error(message);
  }

  return {
    status: String(raw.status ?? "processing"),
    raw,
  };
}

export async function downloadSoraVideoContent(providerJobId: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  contentDisposition: string;
}> {
  const response = await fetch(`${getSoraBaseUrl()}/videos/${encodeURIComponent(providerJobId)}/content`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Unable to download Sora video content.");
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "video/mp4",
    contentDisposition: response.headers.get("content-disposition") || `inline; filename="${providerJobId}.mp4"`,
  };
}
