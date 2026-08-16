import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/contact", "/data-deletion", "/pricing", "/product", "/privacy-policy", "/services", "/terms-of-use", "/workflow", "/cancellation-refund-policy"],
      disallow: ["/admin", "/api", "/auth", "/case-studies", "/forgot-password", "/login", "/portal", "/reset-password", "/results", "/signup", "/wovo-ai"],
    },
    sitemap: "https://wovomedia.com/sitemap.xml",
    host: "https://wovomedia.com",
  };
}
