export const FEED_ALLOWED_MODULES = new Set([
  "captions",
  "ad_studio",
  "spokesperson",
  "landing_visuals",
  "mascot",
  "video_studio",
  "dance_remix",
]);

const LEGACY_MODULE_ALIASES: Record<string, string> = {
  caption: "captions",
  caption_studio: "captions",
  caption_generator: "captions",
  image: "ad_studio",
  image_ad: "ad_studio",
  image_builder: "ad_studio",
  image_ad_builder: "ad_studio",
  offer_visual: "landing_visuals",
  offer_visuals: "landing_visuals",
  landing: "landing_visuals",
  mascot_builder: "mascot",
  ai_spokesperson: "spokesperson",
  spokesperson_studio: "spokesperson",
  video_ad: "video_studio",
  video_ad_studio: "video_studio",
  dance: "dance_remix",
  dance_remix_studio: "dance_remix",
};

const REQUIRED_VIDEO_FEED_MODULES = new Set(["video_studio", "dance_remix"]);
const VIDEO_FEED_MODULES = new Set(["video_studio", "dance_remix", "spokesperson"]);

const SHARED_VIDEO_PATH_PATTERN =
  /^\/api\/wovo\/video\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\?content=1$/i;

export type FeedDistribution = {
  shareToFeed: boolean;
  savedForSocial: boolean;
  decisionMade?: boolean;
  channels: string[];
  updatedAt?: string;
};

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeFeedModuleId(value: unknown): string {
  const normalized = asString(value).trim().toLowerCase();
  if (!normalized) return "";
  return LEGACY_MODULE_ALIASES[normalized] ?? normalized;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function extractVideoJobIdFromPath(value: string): string | null {
  const match = SHARED_VIDEO_PATH_PATTERN.exec(value.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

export function getDistribution(output: Record<string, unknown>): FeedDistribution {
  const extra = asRecord(output.extra);
  const distribution = asRecord(extra.distribution);

  return {
    shareToFeed: Boolean(distribution.shareToFeed),
    savedForSocial: Boolean(distribution.savedForSocial),
    decisionMade: Boolean(distribution.decisionMade),
    channels: Array.isArray(distribution.channels)
      ? distribution.channels.map((channel) => asString(channel)).filter(Boolean)
      : [],
    updatedAt: asString(distribution.updatedAt) || undefined,
  };
}

export function isEligibleFeedPost(row: {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}): boolean {
  const input = asRecord(row.input);
  const output = asRecord(row.output);
  const extra = asRecord(output.extra);
  const distribution = getDistribution(output);
  const moduleId = normalizeFeedModuleId(input.module) || normalizeFeedModuleId(extra.module);
  const mediaImage = asString(output.image).trim();
  const mediaVideo = asString(output.video).trim();
  const text = asString(output.text).trim();
  const videoJobId = asString(extra.videoJobId).trim().toLowerCase();
  const generatedBy = asString(extra.generatedBy).trim().toLowerCase();

  if (!distribution.shareToFeed) return false;
  if (!FEED_ALLOWED_MODULES.has(moduleId)) return false;
  if (generatedBy && generatedBy !== "wovo_ai") return false;
  if (!mediaImage && !mediaVideo && !text) return false;
  if (mediaVideo && !VIDEO_FEED_MODULES.has(moduleId)) return false;
  if (REQUIRED_VIDEO_FEED_MODULES.has(moduleId) && !mediaVideo) return false;
  if (mediaVideo && VIDEO_FEED_MODULES.has(moduleId)) {
    const pathJobId = extractVideoJobIdFromPath(mediaVideo);
    if (!mediaVideo || !pathJobId || !isUuid(videoJobId) || pathJobId !== videoJobId) {
      return false;
    }
  }
  return true;
}
