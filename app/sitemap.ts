import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about",
  "/contact",
  "/cartoon-episodes",
  "/data-deletion",
  "/pricing",
  "/product",
  "/privacy-policy",
  "/services",
  "/workflow",
  "/terms-of-use",
  "/cancellation-refund-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-31T00:00:00.000Z");
  return publicRoutes.map((route) => ({
      url: `https://wovomedia.com${route}`,
      lastModified,
      changeFrequency: route === "" || route === "/pricing" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "" ? 1 : route === "/pricing" ? 0.9 : 0.7,
    }));
}
