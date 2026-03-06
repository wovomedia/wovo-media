import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatRequestBody = {
  message?: string;
  chatId?: string;
  quickAction?: string;
};

type ConsumeCreditRow = {
  consumed: boolean;
  monthly_limit: number;
  monthly_used: number;
  extra_credits: number;
  remaining_credits: number;
};

function getSystemPrompt(quickAction?: string): string {
  const actionInstructions: Record<string, string> = {
    caption: "Generate a concise social caption with a strong CTA.",
    facebook: "Write a Facebook post optimized for engagement and comments.",
    instagram: "Write an Instagram caption with emojis and clear CTA.",
    adcopy: "Write ad copy with hook, benefit, proof, and CTA.",
    image: "Provide an image generation prompt and creative concept details.",
  };

  const action = quickAction ? actionInstructions[quickAction] : null;
  return [
    "You are Wovo AI, a business growth assistant for owners.",
    "Be practical, concise, and conversion-focused.",
    action,
  ].filter(Boolean).join(" ");
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY environment variable" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim() ?? "";

    if (!message) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const consumeRows = await supabaseServiceRoleRequest<ConsumeCreditRow[]>("/rest/v1/rpc/consume_generation_credit", {
      method: "POST",
      body: JSON.stringify({ p_user_id: user.id }),
    });

    const consume = consumeRows?.[0];
    if (!consume?.consumed || consume.remaining_credits < 0) {
      return Response.json({ error: "No credits remaining" }, { status: 402 });
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: getSystemPrompt(body.quickAction) },
          { role: "user", content: message },
        ],
      }),
    });

    if (!openAiResponse.ok || !openAiResponse.body) {
      const details = await openAiResponse.text();
      throw new Error(details || "OpenAI request failed.");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = openAiResponse.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let aggregate = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, assistantText: aggregate })}\n\n`));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (!delta) continue;
              aggregate += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            } catch {
              continue;
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, assistantText: aggregate })}\n\n`));
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
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
