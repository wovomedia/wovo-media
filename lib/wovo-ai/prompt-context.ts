export type CaptionPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

const PLATFORM_LABELS: Record<CaptionPlatform, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
};

const PLATFORM_STYLES: Record<CaptionPlatform, string> = {
  facebook:  "Use a conversational, community-oriented tone suited for local business.",
  instagram: "Use a polished, scroll-stopping style with a strong hook and clean formatting.",
  tiktok:    "Keep it punchy, short, energetic, and trend-aware.",
  youtube:   "Frame it for Shorts/video promotion with strong title-and-caption energy.",
};

export function normalizeCaptionPlatform(input?: string | null): CaptionPlatform | null {
  if (!input) return null;
  const n = input.trim().toLowerCase();
  if (n === "facebook" || n === "instagram" || n === "tiktok" || n === "youtube") return n;
  return null;
}

export function formatPlatformContext(input?: string | null): string {
  const p = normalizeCaptionPlatform(input);
  if (!p) return "";
  return ["Caption Platform Context:", `- Target Platform: ${PLATFORM_LABELS[p]}`, `- Style Guidance: ${PLATFORM_STYLES[p]}`].join("\n");
}

export function formatReferenceImageContext(hasReferenceImage: boolean): string {
  if (!hasReferenceImage) return "";
  return ["Reference Image Context:", "- A reference image was uploaded and should be used as visual guidance.", "- Use it for brand consistency, subject relevance, and style.", "- Do not invent exact details not clearly supported."].join("\n");
}
