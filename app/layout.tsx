import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wovomedia.com"),
  title: {
    default: "WOVO Media | Weekly Marketing Workspace",
    template: "%s | WOVO Media",
  },
  description: "Plan, review, and move weekly marketing forward with a private brand profile, content queue, asset library, and organized support.",
  keywords: "independent business marketing, weekly content workflow, content approval queue, marketing calendar, WOVO Media",
  applicationName: "WOVO Media",
  authors: [{ name: "WOVO Media" }],
  creator: "WOVO Media",
  publisher: "WOVO Media",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "WOVO Media",
    title: "WOVO Media | Weekly Marketing Workspace",
    description: "Turn business context into a focused weekly content plan, approval queue, and organized support.",
    url: "https://wovomedia.com",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "WOVO Media weekly marketing workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WOVO Media | Weekly Marketing Workspace",
    description: "A focused weekly marketing workspace for independent businesses.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
