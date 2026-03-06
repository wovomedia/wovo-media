import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Mode = "chat" | "caption" | "ideas" | "engagement" | "calendar";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Body = {
  message?: string;
  history?: Message[];
  mode?: Mode;
};

const BASE_SYSTEM_PROMPT =
  "You are Wovo AI, a simple AI assistant for small businesses. You specialize in social media captions, marketing ideas, engagement ideas, posting plans, and image prompt writing. Keep responses practical, clear, and easy to use for Facebook, Instagram, TikTok, and Google Business. When asked for a caption, default to a polished ready-to-post caption with a strong hook and a call to action.";

function modeInstruction(mode: Mode): string {
  switch (mode) {
    case "caption":
      return "Return a ready-to-post caption with three parts labeled Hook, Body, and CTA.";
    case "ideas":
      return "Provide practical business content ideas grouped by platform where relevant.";
    case "engagement":
      return "Focus on ways to boost comments, shares, saves, and direct messages.";
    case "calendar":
      return "Provide a concise posting calendar with clear cadence and post themes.";
    case "chat":
    default:
      return "Answer clearly and practically.";
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await request.json()) as Body;
    const message = body.message?.trim() ?? "";
    const history = Array.isArray(body.history) ? body.history : [];
    const mode: Mode = body.mode ?? "chat";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: `${BASE_SYSTEM_PROMPT} ${modeInstruction(mode)}`,
        },
        ...history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = response.output_text?.trim();
    if (!reply) {
      return NextResponse.json({ error: "No reply returned from model." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate reply." }, { status: 500 });
  }
}
