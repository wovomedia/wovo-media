import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "./components/site-chrome";

export const metadata: Metadata = {
  title: "Wovo Media",
  description: "Wovo Media — Social • Web • AI • Drone Media",
  applicationName: "Wovo Media",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-white">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
