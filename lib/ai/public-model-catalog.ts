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
  durationSeconds: 30 | 60 | 120 | 180;
};

// This catalog is intentionally safe for customer-facing code. Infrastructure
// routing, provider IDs, provider prices, and keys stay in the server registry.
export const PUBLIC_MODEL_CATALOG: PublicModelCard[] = [
  {
    id: "adam-auto",
    name: "Adam Auto",
    description: "WOVO chooses the best verified route for your media type and budget.",
    types: ["image", "video", "audio", "social", "cartoon"],
    quality: "recommended",
    badges: ["Recommended", "Lowest surprise"],
    creditsFrom: 2,
    supportedRatios: ["1:1", "9:16", "16:9"],
    supportedResolutions: ["Standard image", "720p video"],
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
    id: "wan-2-2-turbo",
    name: "Wan 2.2 Turbo",
    description: "Short vertical motion from a prompt or reference image at a predictable cost.",
    types: ["video", "cartoon"],
    quality: "fast",
    badges: ["Text to video", "Image to video", "720p"],
    creditsFrom: 12,
    supportedRatios: ["9:16"],
    supportedResolutions: ["720p"],
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

export function estimatePublicCredits(input: {
  type: PublicCreationType;
  modelId: string;
  outputCount?: 1 | 2 | 4;
  durationSeconds?: 30 | 60 | 120 | 180;
}) {
  if (input.modelId === "stable-audio-2-5") return 13;
  if (input.type === "video" || input.type === "cartoon") return 12;
  if (input.type === "audio") return Math.max(2, Math.ceil((input.durationSeconds ?? 30) / 60) * 2);
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

// Adam is the default composer surface. Routing is deterministic and runs in the
// browser so a signed-out visitor sees what WOVO will do before any account or
// provider job exists. It picks the surface only; the server still quotes and
// reserves credits before any paid work starts.
export type AdamRoutedIntent =
  | { kind: "create"; type: PublicCreationType; summary: string }
  | { kind: "find"; summary: string }
  | { kind: "assist"; summary: string };

const ADAM_FIND = /\b(find|search|pull up|show me|open my|where is|look up|my past|earlier)\b/;
const ADAM_ASSIST = /\b(plan|planning|strategy|strategi[sz]e|research|analy[sz]e|prepare|summari[sz]e|report|outreach|follow[- ]?up|draft (?:an? )?(?:email|reply|message)|help me decide|what should i)\b/;
const ADAM_AUDIO = /\b(song|music|jingle|instrumental|soundtrack|audio|track|theme song)\b/;
const ADAM_CARTOON = /\b(cartoon|animated|animation|mascot|character)\b/;
const ADAM_VIDEO = /\b(video|ads?|advert|advertisement|commercial|reel|clip|promo|film|trailer)\b/;
const ADAM_IMAGE = /\b(image|photo|picture|graphic|poster|flyer|logo|thumbnail|banner|menu|headshot)\b/;
const ADAM_SOCIAL = /\b(post|caption|social|instagram|facebook|tiktok|story|stories)\b/;

const ADAM_CREATE_SUMMARY: Record<PublicCreationType, string> = {
  image: "Adam will create an image",
  video: "Adam will create a video",
  audio: "Adam will create audio",
  social: "Adam will create a social post",
  cartoon: "Adam will create a cartoon",
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
