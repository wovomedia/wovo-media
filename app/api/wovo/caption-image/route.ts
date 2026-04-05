import OpenAI from "openai";
import { NextResponse } from "next/server";
import { formatBusinessContext, type BusinessContext, normalizeBusinessContext } from "@/lib/wovo-ai/business-context";
import { guardAiRequest, toAiGuardErrorResponse } from "@/lib/wovo-ai/request-guard";
import { formatPlatformContext, formatReferenceImageContext } from "@/lib/wovo-ai/prompt-context";

export const runtime = "nodejs";

type UserContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" };

const CAPTION_SYS = "You are Wovo Media AI. Create social media captions for businesses that are engaging, clear, promotional, and ready to post. Include a strong hook, body copy, call-to-action, and relevant hashtags.";
const IMG_SYS = "Create a detailed image generation prompt that matches this social media caption. Make it visually appealing, promotional, and suitable for a business marketing post. No logos or text overlays unless requested.";

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
    await guardAiRequest(request.headers.get("authorization"), "caption_image");
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    const { prompt, businessContext, selectedPlatform, referenceImageDataUrl } = await parseRequest(request);
    if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const bcBlock = formatBusinessContext(businessContext);
    const platBlock = formatPlatformContext(selectedPlatform);
    const refBlock = formatReferenceImageContext(Boolean(referenceImageDataUrl));
    const sysCtx = [bcBlock, platBlock, refBlock, "Use provided context. Ignore blank fields."].filter(Boolean).join("\n\n");
    const captionUserContent: UserContent[] | string = referenceImageDataUrl ? [{ type: "input_text", text: prompt }, { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" }] : prompt;
    const captionRes = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      input: [{ role: "system", content: [CAPTION_SYS, sysCtx].filter(Boolean).join("\n\n") }, { role: "user", content: captionUserContent }],
    });
    const caption = captionRes.output_text?.trim();
    if (!caption) return NextResponse.json({ error: "Caption generation failed." }, { status: 502 });
    const imgPromptUserContent: UserContent[] | string = referenceImageDataUrl ? [{ type: "input_text", text: caption }, { type: "input_image", image_url: referenceImageDataUrl, detail: "auto" }] : caption;
    const imgPromptRes = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      input: [{ role: "system", content: [IMG_SYS, sysCtx].filter(Boolean).join("\n\n") }, { role: "user", content: imgPromptUserContent }],
    });
    const imagePrompt = imgPromptRes.output_text?.trim();
    if (!imagePrompt) return NextResponse.json({ error: "Image prompt generation failed." }, { status: 502 });
    const imageResult = await client.images.generate({ model: "gpt-image-1", prompt: imagePrompt, size: "1024x1024" });
    const base64 = imageResult.data?.[0]?.b64_json;
    if (!base64) return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    return NextResponse.json({ caption, imagePrompt, image: `data:image/png;base64,${base64}` });
  } catch (error) {
    const g = toAiGuardErrorResponse(error);
    if (g) return g;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate." }, { status: 500 });
  }
}
