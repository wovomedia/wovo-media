import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wovo Media",
  description: "Nationwide digital growth for local businesses in all 50 states.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
