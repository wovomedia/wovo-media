import OpenAI from "openai";
import { NextResponse } from "next/server";
import { formatBusinessContext, type BusinessContext, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { formatPlatformContext, formatReferenceImageContext } from "@/lib/wovo-ai/prompt-context";

export const runtime = "nodejs";

type UserContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" };

async function parseRequest(request: Request) {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    let bc: Partial<BusinessContext> = {};
    try { bc = JSON.parse(fd.get("businessContext")?.toString() ?? "{}") as Partial<BusinessContext>; } catch { bc = {}; }
    const img = fd.get("referenceImage");
    const imgFile = img instanceof File ? img : null;
    const imgUrl = imgFile ? `data:${imgFile.type||"image/png"};base64,${Buffer.from(await imgFile.arrayBuffer()).toString("base64")}` : null;
    return { prompt: fd.get("prompt")?.toString().trim() ?? "", businessContext: normalizeBusinessContext(bc), selectedPlatform: fd.get("selectedPlatform")?.toString() ?? null, referenceImageDataUrl: imgUrl };
  }
  const body = (await request.json()) as { prompt?: string; businessContext?: Partial<BusinessContext>; selectedPlatform?: string | null };
  return { prompt: body.prompt?.trim() ?? "", businessContext: normalizeBusinessContext(body.businessContext), selectedPlatform: body.selectedPlatform ?? null, referenceImageDataUrl: null };
}

export async function POST(request: Request) {
  try {
    await guardAiRequest(request.headers.get("authorization"), "image");
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    const { prompt, businessContext, selectedPlatform, referenceImageDataUrl } = await parseRequest(request);
    if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const bcBlock = formatBusinessContext(businessContext);
    const platBlock = formatPlatformContext(selectedPlatform);
    const refBlock = formatReferenceImageContext(Boolean(referenceImageDataUrl));
    let finalPrompt = [prompt, bcBlock, platBlock, refBlock, "Create a professional marketing image. No logos or text overlays unless explicitly requested."].filter(Boolean).join("\n\n");
    if (referenceImageDataUrl) {
      const content: UserContent[] = [{ type: "input_text", text: `User request: ${prompt}` }, { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" }];
      const refined = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        input: [{ role: "system", content: ["Refine this into a single detailed image generation prompt for business marketing.", bcBlock, platBlock].filter(Boolean).join("\n\n") }, { role: "user", content }],
      });
      if (refined.output_text?.trim()) finalPrompt = refined.output_text.trim();
    }
    const result = await client.images.generate({ model: "gpt-image-1", prompt: finalPrompt, size: "1024x1024" });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    const g = toAiGuardErrorResponse(error);
    if (g) return g;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate image." }, { status: 500 });
  }
}
