export type CaptionPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

const PLATFORM_LABELS: Record<CaptionPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const PLATFORM_STYLES: Record<CaptionPlatform, string> = {
  facebook: "Use a slightly conversational, local-business friendly, community-oriented tone.",
  instagram: "Use a polished, scroll-stopping style with clean formatting and a strong hook.",
  tiktok: "Keep it punchy, short, energetic, and trend-aware.",
  youtube: "Frame it for Shorts/video promotion with strong title-and-caption energy.",
};

export function normalizeCaptionPlatform(input?: string | null): CaptionPlatform | null {
  if (!input) return null;

  const normalized = input.trim().toLowerCase();
  if (normalized === "facebook" || normalized === "instagram" || normalized === "tiktok" || normalized === "youtube") {
    return normalized;
  }

  return null;
}

export function formatPlatformContext(input?: string | null): string {
  const platform = normalizeCaptionPlatform(input);
  if (!platform) return "";

  return ["Caption Platform Context:", `- Target Platform: ${PLATFORM_LABELS[platform]}`, `- Style Guidance: ${PLATFORM_STYLES[platform]}`].join("\n");
}

export function formatReferenceImageContext(hasReferenceImage: boolean): string {
  if (!hasReferenceImage) return "";

  return [
    "Reference Image Context:",
    "- A reference image was uploaded and should be used as visual guidance when relevant.",
    "- Use it to improve brand consistency, subject relevance, color/vibe inspiration, and overall style.",
    "- Do not invent exact details that are not clearly supported.",
    "- Do not place the uploaded image or logo directly into generated output unless explicitly requested.",
  ].join("\n");
}
