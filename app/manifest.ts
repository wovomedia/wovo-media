import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WOVO Media",
    short_name: "WOVO",
    description: "Create images, video, music and social content with WOVO AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#191714",
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
