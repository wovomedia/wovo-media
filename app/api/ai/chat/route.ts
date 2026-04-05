import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = { message?: string; chatId?: string; quickAction?: string };

function normalizeQuickAction(action?: string): string {
  return (action ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function systemPrompt(action?: string): string {
  const map: Record<string, string> = {
    inspireme: "Share one fresh, brand-safe social idea with a clear hook and CTA.",
    whatstrendinginmyindustry: "Summarize current content trends for this business niche and suggest a post angle.",
    ineedacampaignidea: "Create a concise multi-post campaign concept with theme, hooks, and CTA.",
    howcaniboostengagement: "Recommend practical engagement tactics with post examples and cadence.",
    draftatiktokscript: "Write a short TikTok script with hook, beats, and ending CTA.",
    writeaninstagrampost: "Write an Instagram post with punchy copy, hashtags, and CTA.",
    draftapostingschedulefornextmonth: "Create a four-week posting schedule with post types and goals.",
    caption: "Generate a concise social caption with a clear CTA.",
    facebook: "Write a Facebook post optimized for engagement.",
    instagram: "Write an Instagram caption with emojis and CTA.",
    adcopy: "Write conversion-focused ad copy.",
    image: "Generate a detailed image concept prompt.",
  };
  const normalizedAction = normalizeQuickAction(action);
  return `You are Wovo AI. Be practical, premium, concise. ${map[normalizedAction] ?? ""}`.trim();
}

export async function POST(request: Request) {
  try {
    const openAiApiKey = getEnv("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey: openAiApiKey });

    const { user } = await requireServerUser(request.headers.get("authorization"));
    const contentType = request.headers.get("content-type") ?? "";
    let message = "";
    let chatId = "";
    let quickAction: string | undefined;
    let attachmentContext = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      message = String(form.get("message") ?? "").trim();
      chatId = String(form.get("chatId") ?? "").trim();
      quickAction = String(form.get("quickAction") ?? "");
      const file = form.get("file");
      if (file instanceof File) {
        attachmentContext = `\n\nAttached file: ${file.name} (${file.type || "unknown type"}, ${file.size} bytes).`;
      }
    } else {
      const body = (await request.json()) as Body;
      message = body.message?.trim() ?? "";
      chatId = body.chatId?.trim() ?? "";
      quickAction = body.quickAction;
    }

    if (!message || !chatId) {
      return NextResponse.json({ error: "chatId and message are required." }, { status: 400 });
    }

    await guardAiRequest(request.headers.get("authorization"), "chat");

    await supabaseServiceRoleRequest("/rest/v1/messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ chat_id: chatId, user_id: user.id, role: "user", content: `${message}${attachmentContext}` }),
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(quickAction) },
        { role: "user", content: `${message}${attachmentContext}` },
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
    const guardError = toAiGuardErrorResponse(error);
    if (guardError) return guardError;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat failed." }, { status: 500 });
  }
}
