import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wovo Media",
    short_name: "Wovo",
    description: "Wovo Media AI + agency platform for restaurant growth.",
    start_url: "/",
    display: "standalone",
    background_color: "#060a09",
    theme_color: "#060a09",
    icons: [
      {
        src: "/images/brand/wovo-glow-icon.svg",
        sizes: "1024x1024",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
