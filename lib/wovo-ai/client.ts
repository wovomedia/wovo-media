export type WovoAiPayload = {
  business_name: string;
  business_type: string;
  location: string;
  contact: string;
  topic: string;
  goal: string;
};

export type WovoAiResult = {
  captions: Record<string, string> | null;
  generated_image_data: unknown;
  data?: unknown;
};

export async function generateWovoAiContent(payload: WovoAiPayload): Promise<WovoAiResult> {
  const response = await fetch("/api/wovo-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => null)) as
    | (WovoAiResult & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(json && "error" in json && json.error ? json.error : "Failed to generate Wovo AI content.");
  }

  return (json ?? { captions: null, generated_image_data: null }) as WovoAiResult;
}
