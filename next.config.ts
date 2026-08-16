import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["wovomedia.com", "www.wovomedia.com"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
  },
  async headers() {
    const authShellHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store, max-age=0, must-revalidate",
      },
    ];

    return [
      { source: "/login", headers: authShellHeaders },
      { source: "/signup", headers: authShellHeaders },
      { source: "/forgot-password", headers: authShellHeaders },
      { source: "/reset-password", headers: authShellHeaders },
      { source: "/auth/callback", headers: authShellHeaders },
      { source: "/portal/:path*", headers: authShellHeaders },
    ];
  },
  async redirects() {
    return [
      {
        source: "/wovo-ai/:path*",
        destination: "/portal",
        permanent: false,
      },
      {
        // Collapse www onto the apex so there is exactly one canonical origin.
        // Sessions and the PKCE verifier live in origin-scoped browser storage,
        // so a user drifting between hosts silently loses both.
        source: "/:path*",
        has: [{ type: "host", value: "www.wovomedia.com" }],
        destination: "https://wovomedia.com/:path*",
        permanent: true,
      },
      {
        // Nothing links here, but the path is intuitive enough that people type
        // it. Send them where the nav's "Support" link already goes.
        source: "/support",
        destination: "/contact",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
