import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wovo Media | Content, AI & Growth for Every Business",
  description: "Wovo Media helps restaurants, healthcare, farms, government, and every local business grow with professional video production, drone filming, social media management, and AI tools. Licensed, insured, drone certified. 24/7 support. Based in Tennessee, serving all 50 states.",
  keywords: "social media marketing, AI content creation, video production, drone filming, restaurant marketing, Tennessee media company, Wovo AI, Wovo Media",
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
