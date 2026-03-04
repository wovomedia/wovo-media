import OpenAI from "openai";
import { NextResponse } from "next/server";
import { consumeOneCredit } from "@/lib/wovo-ai/credits";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = { message?: string; chatId?: string; quickAction?: string };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function systemPrompt(action?: string): string {
  const map: Record<string, string> = {
    caption: "Generate a concise social caption with a clear CTA.",
    facebook: "Write a Facebook post optimized for engagement.",
    instagram: "Write an Instagram caption with emojis and CTA.",
    adcopy: "Write conversion-focused ad copy.",
    image: "Generate a detailed image concept prompt.",
  };
  return `You are Wovo AI. Be practical, premium, concise. ${map[action ?? ""] ?? ""}`.trim();
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as Body;
    const message = body.message?.trim();
    const chatId = body.chatId?.trim();

    if (!message || !chatId) {
      return NextResponse.json({ error: "chatId and message are required." }, { status: 400 });
    }

    await consumeOneCredit(user.id);

    await supabaseServiceRoleRequest("/rest/v1/messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ chat_id: chatId, user_id: user.id, role: "user", content: message }),
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(body.quickAction) },
        { role: "user", content: message },
      ],
    });

    const assistantText = completion.choices[0]?.message?.content?.trim() || "I couldn't generate a response.";

    const rows = await supabaseServiceRoleRequest<Array<{ id: string; role: "assistant"; content: string; created_at: string }>>(
      "/rest/v1/messages?select=id,role,content,created_at",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ chat_id: chatId, user_id: user.id, role: "assistant", content: assistantText }),
      },
    );

    return NextResponse.json({ assistantMessage: rows?.[0], text: assistantText });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat failed." }, { status: 500 });
  }
}
