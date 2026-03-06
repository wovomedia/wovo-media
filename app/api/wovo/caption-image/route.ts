import OpenAI from "openai";
import { NextResponse } from "next/server";
import { formatBusinessContext, type BusinessContext, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";
import { formatPlatformContext, formatReferenceImageContext } from "@/lib/wovo-ai/prompt-context";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  businessContext?: Partial<BusinessContext>;
  selectedPlatform?: string | null;
};

type UserResponseContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

const CAPTION_SYSTEM_PROMPT =
  "You are Wovo AI. Create social media captions for small businesses that are engaging, clear, promotional, and ready to post.";

const IMAGE_PROMPT_INSTRUCTION =
  "Create a detailed image generation prompt that matches this social media caption. Make it visually appealing, promotional, and suitable for a business marketing post.";

async function parseIncomingRequest(request: Request): Promise<{
  prompt: string;
  businessContext: BusinessContext;
  selectedPlatform: string | null;
  referenceImageDataUrl: string | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawBusinessContext = formData.get("businessContext")?.toString() ?? "{}";
    const referenceImage = formData.get("referenceImage");
    const referenceImageFile = referenceImage instanceof File ? referenceImage : null;

    let parsedBusinessContext: Partial<BusinessContext> = {};
    try {
      parsedBusinessContext = JSON.parse(rawBusinessContext) as Partial<BusinessContext>;
    } catch {
      parsedBusinessContext = {};
    }

    const referenceImageDataUrl = referenceImageFile
      ? `data:${referenceImageFile.type || "image/png"};base64,${Buffer.from(await referenceImageFile.arrayBuffer()).toString("base64")}`
      : null;

    return {
      prompt: formData.get("prompt")?.toString().trim() ?? "",
      businessContext: normalizeBusinessContext(parsedBusinessContext),
      selectedPlatform: formData.get("selectedPlatform")?.toString() ?? null,
      referenceImageDataUrl,
    };
  }

  const body = (await request.json()) as Body;
  return {
    prompt: body.prompt?.trim() ?? "",
    businessContext: normalizeBusinessContext(body.businessContext),
    selectedPlatform: body.selectedPlatform ?? null,
    referenceImageDataUrl: null,
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const { prompt, businessContext, selectedPlatform, referenceImageDataUrl } = await parseIncomingRequest(request);
    const businessContextBlock = formatBusinessContext(businessContext);
    const platformContextBlock = formatPlatformContext(selectedPlatform);
    const referenceImageContextBlock = formatReferenceImageContext(Boolean(referenceImageDataUrl));

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const captionUserContent: UserResponseContent[] | string = referenceImageDataUrl
      ? [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" },
        ]
      : prompt;

    const captionResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            CAPTION_SYSTEM_PROMPT,
            businessContextBlock,
            platformContextBlock,
            referenceImageContextBlock,
            "Instruction: Use the provided context when relevant. Do not invent missing details. If a field is blank, ignore it.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        {
          role: "user",
          content: captionUserContent,
        },
      ],
    });
    const caption = captionResponse.output_text?.trim();

    if (!caption) {
      return NextResponse.json({ error: "Caption generation failed." }, { status: 502 });
    }

    const imagePromptUserContent: UserResponseContent[] | string = referenceImageDataUrl
      ? [
          { type: "input_text", text: caption },
          { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" },
        ]
      : caption;

    const imagePromptResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            IMAGE_PROMPT_INSTRUCTION,
            businessContextBlock,
            platformContextBlock,
            referenceImageContextBlock,
            "Instruction: Use business details and reference guidance when available.",
            "Do not include phone numbers, email addresses, text overlays, or direct logo placement unless explicitly requested.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        {
          role: "user",
          content: imagePromptUserContent,
        },
      ],
    });
    const imagePrompt = imagePromptResponse.output_text?.trim();

    if (!imagePrompt) {
      return NextResponse.json({ error: "Image prompt generation failed." }, { status: 502 });
    }

    const imageResult = await client.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
    });

    const imageBase64 = imageResult.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    }

    return NextResponse.json({
      caption,
      imagePrompt,
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate caption and image." }, { status: 500 });
  }
}
