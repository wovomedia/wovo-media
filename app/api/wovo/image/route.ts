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

    let finalImagePrompt = [
      prompt,
      businessContextBlock,
      platformContextBlock,
      referenceImageContextBlock,
      "Instruction: Use context to improve subject relevance, style consistency, and marketing intent.",
      "Do not place logos, uploaded source imagery, or text overlays into the final image unless explicitly requested by the user.",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (referenceImageDataUrl) {
      const promptRefinement = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        input: [
          {
            role: "system",
            content: [
              "You refine image-generation prompts for business marketing creatives.",
              businessContextBlock,
              platformContextBlock,
              referenceImageContextBlock,
              "Return one concise but descriptive image prompt only.",
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: `User request: ${prompt}` },
              { type: "input_image", image_url: referenceImageDataUrl },
            ],
          },
        ],
      });

      const refinedPrompt = promptRefinement.output_text?.trim();
      if (refinedPrompt) {
        finalImagePrompt = refinedPrompt;
      }
    }

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: finalImagePrompt,
      size: "1024x1024",
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) {
      return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    }

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate image." }, { status: 500 });
  }
}
