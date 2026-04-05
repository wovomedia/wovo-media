import { getEnv } from "@/lib/env";

export type AiProvider = "auto" | "openai" | "grok";

type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ProviderCandidate = {
  provider: "openai" | "grok";
  model: string;
  text: string;
};

export type ProviderResult = {
  text: string;
  provider: AiProvider;
  model: string;
  candidates: ProviderCandidate[];
};

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
};

function getOpenAiModel(): string {
  return getEnv("OPENAI_MODEL") || "gpt-5";
}

function getOpenAiTextModel(): string {
  return getEnv("OPENAI_TEXT_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4o-mini";
}

function getXaiModel(): string {
  return getEnv("XAI_MODEL") || "grok-4-1-fast";
}

function getXaiBaseUrl(): string {
  return (getEnv("XAI_BASE_URL") || "https://api.x.ai/v1").replace(/\/$/, "");
}

export function normalizeProvider(input: string | null | undefined): AiProvider {
  const normalized = (input ?? "").trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "grok") return "grok";
  return "auto";
}

async function callOpenAi(messages: ChatMessage[], temperature = 0.6): Promise<ProviderCandidate> {
  const key = getEnv("OPENAI_API_KEY");
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: getOpenAiTextModel(),
      temperature,
      stream: false,
      messages,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI text generation failed.");
  }

  const text = String(payload.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("OpenAI returned empty text output.");
  return {
    provider: "openai",
    model: String(payload.model || getOpenAiTextModel()),
    text,
  };
}

async function callGrok(messages: ChatMessage[], temperature = 0.6): Promise<ProviderCandidate> {
  const key = getEnv("XAI_API_KEY");
  if (!key) {
    throw new Error("XAI_API_KEY is not configured.");
  }

  const response = await fetch(`${getXaiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: getXaiModel(),
      temperature,
      stream: false,
      messages,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || "Grok text generation failed.");
  }

  const text = String(payload.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Grok returned empty text output.");
  return {
    provider: "grok",
    model: String(payload.model || getXaiModel()),
    text,
  };
}

async function synthesizeCandidates(candidates: ProviderCandidate[]): Promise<ProviderResult> {
  if (candidates.length === 1) {
    const only = candidates[0];
    return {
      text: only.text,
      provider: only.provider,
      model: only.model,
      candidates,
    };
  }

  try {
    const synthesisPrompt: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are Wovo AI's quality merge system. Combine candidate outputs into one final response that is concise, practical, and restaurant-owner ready.",
      },
      {
        role: "user",
        content: [
          "Candidate A:",
          candidates[0]?.text ?? "",
          "",
          "Candidate B:",
          candidates[1]?.text ?? "",
          "",
          "Return a single improved final answer.",
        ].join("\n"),
      },
    ];
    const merged = await callOpenAi(synthesisPrompt, 0.3);
    return {
      text: merged.text,
      provider: "auto",
      model: `${merged.model} (synthesized)`,
      candidates,
    };
  } catch {
    const fallback = [...candidates].sort((a, b) => b.text.length - a.text.length)[0];
    return {
      text: fallback.text,
      provider: "auto",
      model: `${fallback.model} (fallback)`,
      candidates,
    };
  }
}

export async function generateTextWithProviders(params: {
  provider?: string | null;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<ProviderResult> {
  const provider = normalizeProvider(params.provider);
  const temperature = params.temperature ?? 0.6;

  if (provider === "openai") {
    const openai = await callOpenAi(params.messages, temperature);
    return {
      text: openai.text,
      provider: "openai",
      model: openai.model,
      candidates: [openai],
    };
  }

  if (provider === "grok") {
    const grok = await callGrok(params.messages, temperature);
    return {
      text: grok.text,
      provider: "grok",
      model: grok.model,
      candidates: [grok],
    };
  }

  const candidates: ProviderCandidate[] = [];
  const tasks: Array<Promise<ProviderCandidate>> = [];

  if (getEnv("OPENAI_API_KEY")) {
    tasks.push(callOpenAi(params.messages, temperature));
  }
  if (getEnv("XAI_API_KEY")) {
    tasks.push(callGrok(params.messages, temperature));
  }

  if (tasks.length === 0) {
    throw new Error("Wovo AI generation engine keys are not configured.");
  }

  const settled = await Promise.allSettled(tasks);
  settled.forEach((item) => {
    if (item.status === "fulfilled") {
      candidates.push(item.value);
    }
  });

  if (candidates.length === 0) {
    const firstError = settled.find((item) => item.status === "rejected");
    throw new Error(firstError && "reason" in firstError && firstError.reason instanceof Error ? firstError.reason.message : "Automatic generation failed.");
  }

  return synthesizeCandidates(candidates);
}

export async function generateImageFromOpenAi(prompt: string): Promise<{ image: string; model: string }> {
  const key = getEnv("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ b64_json?: string }>;
    model?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI image generation failed.");
  }

  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI did not return image bytes.");
  return {
    image: `data:image/png;base64,${base64}`,
    model: String(payload.model || "gpt-image-1"),
  };
}

export function buildWovoSystemPrompt(basePrompt: string, sections: Array<string | null | undefined>): string {
  return [basePrompt, ...sections].filter(Boolean).join("\n\n");
}

export function getOpenAiRoutingModel(): string {
  return getOpenAiModel();
}
