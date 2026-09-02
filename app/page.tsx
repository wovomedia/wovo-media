import type { Metadata } from "next";
import WovoCreateExperience from "./WovoCreateExperience";

export const metadata: Metadata = {
  title: "Create Images, Videos, Audio, Cartoons, and Social Content",
  description: "Create with WOVO AI from one prompt. Choose a verified model, see the exact WOVO Credit cost, then save, download, edit, or publish your result.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <WovoCreateExperience />;
}
