import OpenAI from "openai";
import { customerSafeMessage, internalErrorCode } from "@/lib/errors/customer-safe";
import { NextResponse } from "next/server";
import { formatBusinessContext, type BusinessContext, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { formatPlatformContext, formatReferenceImageContext } from "@/lib/wovo-ai/prompt-context";

export const runtime = "nodejs";

type Mode = "chat" | "caption" | "ideas" | "engagement" | "calendar";
type Message = { role: "user" | "assistant"; content: string };
type UserContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" };
type Body = { message?: string; history?: Message[]; mode?: Mode; businessContext?: Partial<BusinessContext>; selectedPlatform?: string | null };

const BASE_SYSTEM = "You are Wovo Media AI, a smart AI assistant for small businesses. You specialize in social media captions, marketing ideas, engagement strategies, content calendars, and image prompt writing. Keep responses practical and ready-to-post. When writing captions, always include a strong hook, body copy, and clear call-to-action.";

function modeInstruction(mode: Mode): string {
  const map: Record<Mode, string> = {
    caption:    "Return a ready-to-post caption with Hook, Body, and CTA labeled.",
    ideas:      "Give practical, specific content ideas grouped by platform where relevant.",
    engagement: "Focus on tactics to boost comments, shares, saves, and DMs with examples.",
    calendar:   "Create a concise posting calendar with clear cadence, themes, and goals.",
    chat:       "Answer clearly, practically, and conversationally.",
  };
  return map[mode] ?? map.chat;
}

async function parseRequest(request: Request) {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    let history: Message[] = [], bc: Partial<BusinessContext> = {};
    try { history = JSON.parse(fd.get("history")?.toString() ?? "[]") as Message[]; } catch { history = []; }
    try { bc = JSON.parse(fd.get("businessContext")?.toString() ?? "{}") as Partial<BusinessContext>; } catch { bc = {}; }
    const img = fd.get("referenceImage");
    const imgFile = img instanceof File ? img : null;
    const imgUrl = imgFile ? `data:${imgFile.type||"image/png"};base64,${Buffer.from(await imgFile.arrayBuffer()).toString("base64")}` : null;
    return { message: fd.get("message")?.toString().trim() ?? "", history, mode: (fd.get("mode")?.toString() as Mode) ?? "chat", businessContext: normalizeBusinessContext(bc), selectedPlatform: fd.get("selectedPlatform")?.toString() ?? null, referenceImageDataUrl: imgUrl };
  }
  const body = (await request.json()) as Body;
  return { message: body.message?.trim() ?? "", history: Array.isArray(body.history) ? body.history : [], mode: body.mode ?? "chat", businessContext: normalizeBusinessContext(body.businessContext), selectedPlatform: body.selectedPlatform ?? null, referenceImageDataUrl: null };
}

export async function POST(request: Request) {
  try {
    await guardAiRequest(request.headers.get("authorization"), "chat");
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    const { message, history, mode, businessContext, selectedPlatform, referenceImageDataUrl } = await parseRequest(request);
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
    const ctx = [formatBusinessContext(businessContext), formatPlatformContext(selectedPlatform), formatReferenceImageContext(Boolean(referenceImageDataUrl))].filter(Boolean).join("\n\n");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const userContent: UserContent[] | string = referenceImageDataUrl ? [{ type: "input_text", text: message }, { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" }] : message;
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      input: [
        { role: "system", content: [`${BASE_SYSTEM} ${modeInstruction(mode)}`, ctx, "Use context when relevant. Ignore blank fields."].filter(Boolean).join("\n\n") },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: userContent },
      ],
    });
    const reply = response.output_text?.trim();
    if (!reply) return NextResponse.json({ error: "No reply returned." }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error) {
    const g = toAiGuardErrorResponse(error);
    if (g) return g;
    console.error("wovo_chat_failed", { code: internalErrorCode(error, "WOVO_CHAT_FAILED") });
    return NextResponse.json({ error: customerSafeMessage(error, "Unable to generate reply.") }, { status: 500 });
  }
}
