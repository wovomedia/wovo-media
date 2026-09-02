import type { Metadata } from "next";
import WovoCreateExperience, { type CreationAvailability } from "./WovoCreateExperience";

export const metadata: Metadata = {
  title: "Create Images, Videos, Audio, Cartoons, and Social Content",
  description: "Create with WOVO AI from one prompt. Choose a verified model, see the exact WOVO Credit cost, then save, download, edit, or publish your result.",
  alternates: { canonical: "/" },
};

// The composer must not offer a tool the server will refuse. Each creation type
// is advertised only when its provider keys and feature flag are actually set,
// so a visitor never sees a price for work WOVO cannot currently do.
function creationAvailability(): CreationAvailability {
  const mediaKeysReady =
    Boolean(process.env.OPENAI_API_KEY)
    && Boolean(process.env.FAL_API_KEY || process.env.FAL_KEY);
  return {
    image: mediaKeysReady,
    social: mediaKeysReady,
    video: mediaKeysReady && process.env.WOVO_VIDEO_GENERATION_ENABLED === "true",
    audio: mediaKeysReady && process.env.WOVO_MUSIC_GENERATION_ENABLED === "true",
    cartoon: mediaKeysReady && process.env.WOVO_CARTOON_VIDEO_ENABLED === "true",
  };
}

export default function HomePage() {
  return <WovoCreateExperience availability={creationAvailability()} />;
}
