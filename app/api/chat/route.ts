import { POST as generateRoute } from "@/app/api/wovo-ai/generate/route";

export const runtime = "nodejs";

function formatAssistantText(payload: {
  captions?: string[];
  hashtags?: string[];
  image_prompt?: string;
  image?: { url?: string } | null;
}) {
  const captions = payload.captions ?? [];
  const hashtags = payload.hashtags ?? [];
  const imagePrompt = payload.image_prompt ?? "";
  const imageUrl = payload.image?.url;

  const sections: string[] = [];
  if (captions.length > 0) {
    sections.push(`Captions:\n${captions.map((caption, index) => `${index + 1}. ${caption}`).join("\n")}`);
  }
  if (hashtags.length > 0) {
    sections.push(`Hashtags:\n${hashtags.join(" ")}`);
  }
  if (imagePrompt) {
    sections.push(`Image prompt:\n${imagePrompt}`);
  }
  if (imageUrl) {
    sections.push(`Generated image:\n${imageUrl}`);
  }

  return sections.join("\n\n").trim() || "I generated your content.";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: string;
    business_name?: string;
    business_type?: string;
    location?: string;
    contact?: string;
    goal?: string;
    reference_image?: string | null;
  };

  const forwardedRequest = new Request(request.url.replace("/chat", "/wovo-ai/generate"), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  });

  const generateResponse = await generateRoute(forwardedRequest);
  const payload = (await generateResponse.json()) as {
    message?: string;
    error?: string;
    captions?: string[];
    hashtags?: string[];
    image_prompt?: string;
    image?: { url?: string } | null;
  };

  if (!generateResponse.ok) {
    return Response.json({ error: payload.message ?? payload.error ?? "Unable to generate content." }, { status: generateResponse.status });
  }

  const assistantText = formatAssistantText(payload);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of assistantText.match(/.{1,120}/g) ?? []) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, payload, assistantText })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
