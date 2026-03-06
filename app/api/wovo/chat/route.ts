import OpenAI from "openai";
import { NextResponse } from "next/server";
import { formatBusinessContext, type BusinessContext, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { formatPlatformContext, formatReferenceImageContext } from "@/lib/wovo-ai/prompt-context";

export const runtime = "nodejs";

type Mode = "chat" | "caption" | "ideas" | "engagement" | "calendar";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type UserResponseContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

type Body = {
  message?: string;
  history?: Message[];
  mode?: Mode;
  businessContext?: Partial<BusinessContext>;
  selectedPlatform?: string | null;
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

async function parseIncomingRequest(request: Request): Promise<{
  message: string;
  history: Message[];
  mode: Mode;
  businessContext: BusinessContext;
  selectedPlatform: string | null;
  referenceImageDataUrl: string | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawHistory = formData.get("history")?.toString() ?? "[]";
    const rawBusinessContext = formData.get("businessContext")?.toString() ?? "{}";
    const referenceImage = formData.get("referenceImage");
    const referenceImageFile = referenceImage instanceof File ? referenceImage : null;

    let parsedHistory: Message[] = [];
    let parsedBusinessContext: Partial<BusinessContext> = {};

    try {
      parsedHistory = JSON.parse(rawHistory) as Message[];
    } catch {
      parsedHistory = [];
    }

    try {
      parsedBusinessContext = JSON.parse(rawBusinessContext) as Partial<BusinessContext>;
    } catch {
      parsedBusinessContext = {};
    }

    const referenceImageDataUrl = referenceImageFile
      ? `data:${referenceImageFile.type || "image/png"};base64,${Buffer.from(await referenceImageFile.arrayBuffer()).toString("base64")}`
      : null;

    return {
      message: formData.get("message")?.toString().trim() ?? "",
      history: Array.isArray(parsedHistory) ? parsedHistory : [],
      mode: (formData.get("mode")?.toString() as Mode) ?? "chat",
      businessContext: normalizeBusinessContext(parsedBusinessContext),
      selectedPlatform: formData.get("selectedPlatform")?.toString() ?? null,
      referenceImageDataUrl,
    };
  }

  const body = (await request.json()) as Body;
  return {
    message: body.message?.trim() ?? "",
    history: Array.isArray(body.history) ? body.history : [],
    mode: body.mode ?? "chat",
    businessContext: normalizeBusinessContext(body.businessContext),
    selectedPlatform: body.selectedPlatform ?? null,
    referenceImageDataUrl: null,
  };
}

export async function POST(request: Request) {
  try {
    await guardAiRequest(request.headers.get("authorization"), "chat");

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const { message, history, mode, businessContext, selectedPlatform, referenceImageDataUrl } = await parseIncomingRequest(request);
    const businessContextBlock = formatBusinessContext(businessContext);
    const platformContextBlock = formatPlatformContext(selectedPlatform);
    const referenceImageContextBlock = formatReferenceImageContext(Boolean(referenceImageDataUrl));

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const userContent: UserResponseContent[] | string = referenceImageDataUrl
      ? [
          { type: "input_text", text: message },
          { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" },
        ]
      : message;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            `${BASE_SYSTEM_PROMPT} ${modeInstruction(mode)}`,
            businessContextBlock,
            platformContextBlock,
            referenceImageContextBlock,
            "Instruction: Use the provided context when relevant. Do not invent missing details. If a field is blank, ignore it.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        ...history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const reply = response.output_text?.trim();
    if (!reply) {
      return NextResponse.json({ error: "No reply returned from model." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const guardError = toAiGuardErrorResponse(error);
    if (guardError) return guardError;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate reply." }, { status: 500 });
  }
}
