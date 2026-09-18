export type PublicCreationType = "image" | "video" | "audio" | "social" | "cartoon";

export type PublicModelCard = {
  id: string;
  name: string;
  description: string;
  types: PublicCreationType[];
  quality: "recommended" | "standard" | "fast" | "premium";
  badges: string[];
  creditsFrom: number;
  supportedRatios: Array<"1:1" | "9:16" | "16:9">;
  supportedResolutions: string[];
  /** Max single-clip length this route supports (seconds). */
  maxDurationSeconds?: number;
  audioDefault?: boolean;
};

export type PublicGenerationMode =
  | "prompt-to-image"
  | "reference-to-image"
  | "text-to-video"
  | "image-to-video"
  | "instrumental"
  | "caption-and-image"
  | "character-video";

export type PublicGenerationSettings = {
  type: PublicCreationType;
  modelId: string;
  mode: PublicGenerationMode;
  outputCount: 1 | 2 | 4;
  durationSeconds: 5 | 10 | 15 | 30 | 60 | 120 | 180;
};

// Customer-facing catalog only. Provider IDs and raw $ costs stay server-side.
export const PUBLIC_MODEL_CATALOG: PublicModelCard[] = [
  {
    id: "adam-auto",
    name: "Adam Auto",
    description: "WOVO picks the best verified route for your media type, length, and budget.",
    types: ["image", "video", "audio", "social", "cartoon"],
    quality: "recommended",
    badges: ["Recommended", "Audio on for video"],
    creditsFrom: 2,
    supportedRatios: ["1:1", "9:16", "16:9"],
    supportedResolutions: ["Standard image", "720p–1080p video"],
    maxDurationSeconds: 30,
    audioDefault: true,
  },
  {
    id: "flux-2",
    name: "FLUX 2",
    description: "Fast, polished image generation for ads, products, food, and social posts.",
    types: ["image", "social"],
    quality: "standard",
    badges: ["Text to image", "Fast"],
    creditsFrom: 2,
    supportedRatios: ["1:1", "9:16", "16:9"],
    supportedResolutions: ["Standard"],
  },
  {
    id: "kling-3-pro",
    name: "Kling 3.0",
    description: "Cinematic image-to-video and text-to-video with native audio — ideal for listing walkthroughs and product motion.",
    types: ["video", "cartoon"],
    quality: "premium",
    badges: ["Cinematic", "Native audio", "Image to video"],
    creditsFrom: 51,
    supportedRatios: ["9:16", "16:9", "1:1"],
    supportedResolutions: ["720p", "1080p"],
    maxDurationSeconds: 15,
    audioDefault: true,
  },
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    description: "Strong motion and built-in audio for short films, reels, and multi-shot style clips up to 15 seconds.",
    types: ["video", "cartoon"],
    quality: "standard",
    badges: ["Native audio", "Multi-shot friendly"],
    creditsFrom: 73,
    supportedRatios: ["9:16", "16:9", "1:1"],
    supportedResolutions: ["720p"],
    maxDurationSeconds: 15,
    audioDefault: true,
  },
  {
    id: "seedance-2-5",
    name: "Seedance 2.5",
    description: "Longer single-pass video (up to about 30 seconds) with audio — for fuller walkthroughs and promo sequences.",
    types: ["video", "cartoon"],
    quality: "premium",
    badges: ["Up to ~30s", "Native audio"],
    creditsFrom: 142,
    supportedRatios: ["9:16", "16:9", "1:1"],
    supportedResolutions: ["720p"],
    maxDurationSeconds: 30,
    audioDefault: true,
  },
  {
    id: "cassette-music",
    name: "CassetteAI Music",
    description: "Affordable instrumental tracks, jingles, and background music up to three minutes.",
    types: ["audio"],
    quality: "fast",
    badges: ["Commercial-use output", "Fast"],
    creditsFrom: 2,
    supportedRatios: ["1:1"],
    supportedResolutions: ["Audio"],
  },
  {
    id: "stable-audio-2-5",
    name: "Stable Audio 2.5",
    description: "A richer fixed-price audio render for polished brand and campaign sound.",
    types: ["audio"],
    quality: "premium",
    badges: ["Premium audio", "Fixed price"],
    creditsFrom: 13,
    supportedRatios: ["1:1"],
    supportedResolutions: ["Audio"],
  },
];

/**
 * Approximate public credit estimate (client-side). Server re-quotes before charge.
 * Video scales with length so a 30s prompt is never shown as a cheap 5s job.
 *
 * Ballpark (80% margin at $0.08333/credit floor):
 * - Kling 3.0 Pro + audio: ~$0.168/s → 5s≈51, 10s≈101, 15s≈152 credits
 * - Seedance 2.0 Fast: ~$0.242/s → 5s≈73, 10s≈146, 15s≈218 credits
 * - Seedance 2.5 long: ~$0.473/s → 15s≈426, 30s≈852 credits
 */
export function estimatePublicCredits(input: {
  type: PublicCreationType;
  modelId: string;
  outputCount?: 1 | 2 | 4;
  durationSeconds?: number;
}) {
  if (input.modelId === "stable-audio-2-5") return 13;
  if (input.type === "audio") {
    return Math.max(2, Math.ceil((input.durationSeconds ?? 30) / 60) * 2);
  }
  if (input.type === "video" || input.type === "cartoon") {
    const seconds = Math.max(5, Math.min(30, Math.round(input.durationSeconds ?? 10)));
    if (input.modelId === "seedance-2-5" || seconds > 15) {
      // Long route
      if (seconds <= 15) return 426;
      return 852;
    }
    if (input.modelId === "seedance-2") {
      if (seconds <= 5) return 73;
      if (seconds <= 10) return 146;
      return 218;
    }
    // Default / Kling 3.0 / Adam Auto cinematic
    if (seconds <= 5) return 51;
    if (seconds <= 10) return 101;
    return 152;
  }
  return 2 * (input.outputCount ?? 1);
}

export function defaultPublicMode(type: PublicCreationType): PublicGenerationMode {
  if (type === "video") return "text-to-video";
  if (type === "audio") return "instrumental";
  if (type === "social") return "caption-and-image";
  if (type === "cartoon") return "character-video";
  return "prompt-to-image";
}

export function publicModeLabel(mode: PublicGenerationMode) {
  return mode.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

export type AdamRoutedIntent =
  | { kind: "create"; type: PublicCreationType; summary: string }
  | { kind: "find"; summary: string }
  | { kind: "assist"; summary: string };

const ADAM_FIND = /\b(find|search|pull up|show me|open my|where is|look up|my past|earlier)\b/;
const ADAM_ASSIST = /\b(plan|planning|strategy|strategi[sz]e|research|analy[sz]e|prepare|summari[sz]e|report|outreach|follow[- ]?up|draft (?:an? )?(?:email|reply|message)|help me decide|what should i)\b/;
const ADAM_AUDIO = /\b(song|music|jingle|instrumental|soundtrack|audio|track|theme song)\b/;
const ADAM_CARTOON = /\b(cartoon|animated|animation|mascot|character)\b/;
const ADAM_VIDEO = /\b(video|ads?|advert|advertisement|commercial|reel|clip|promo|film|trailer|walkthrough|walk[- ]through)\b/;
const ADAM_IMAGE = /\b(image|photo|picture|graphic|poster|flyer|logo|thumbnail|banner|menu|headshot)\b/;
const ADAM_SOCIAL = /\b(post|caption|social|instagram|facebook|tiktok|story|stories)\b/;

const ADAM_CREATE_SUMMARY: Record<PublicCreationType, string> = {
  image: "Adam will create an image",
  video: "Adam will create a video with audio",
  audio: "Adam will create audio",
  social: "Adam will create a social post",
  cartoon: "Adam will create a cartoon with audio",
};

function adamCreate(type: PublicCreationType): AdamRoutedIntent {
  return { kind: "create", type, summary: ADAM_CREATE_SUMMARY[type] };
}

export function routeAdamPrompt(prompt: string): AdamRoutedIntent {
  const text = prompt.trim().toLowerCase();
  if (!text) return { kind: "assist", summary: "Adam will pick the right tool" };
  if (ADAM_FIND.test(text)) return { kind: "find", summary: "Adam will search your workspace" };
  if (ADAM_ASSIST.test(text)) return { kind: "assist", summary: "Adam will help you plan this" };
  if (ADAM_AUDIO.test(text)) return adamCreate("audio");
  if (ADAM_CARTOON.test(text)) return adamCreate("cartoon");
  if (ADAM_VIDEO.test(text)) return adamCreate("video");
  if (ADAM_IMAGE.test(text)) return adamCreate("image");
  if (ADAM_SOCIAL.test(text)) return adamCreate("social");
  return adamCreate("image");
}
