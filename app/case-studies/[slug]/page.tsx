"use client";

import Link from "next/link";

const CLIENTS: Record<string, any> = {
  "campbell-station": {
    name: "Campbell Station",
    location: "Culleoka, TN",
    headline: "2,000,000+ views every 28 days",
    description:
      "Full social media management, content production, live events, Facebook monetization, and website support.",
  },
  "boot-stompin-bbq": {
    name: "Boot Stompin’ BBQ",
    location: "Columbia, TN",
    headline: "Consistent growth + brand presence",
    description:
      "Short-form video, Facebook growth, website support, and community engagement.",
  },
  "erwin-heating": {
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    headline: "Call-driven HVAC marketing",
    description:
      "Lead-focused content, call ads, and conversion optimization.",
  },
  "dark-knight": {
    name: "Dark Knight Contractors",
    location: "Knoxville, TN",
    headline: "Local contractor visibility",
    description:
      "Brand setup, Facebook presence, and ongoing content strategy.",
  },
  "liquid-fire": {
    name: "Liquid Fire Vintage Neon",
    location: "Franklin, TN",
    headline: "High-end visual branding",
    description:
      "Website, social presence, and visual storytelling for premium signage.",
  },
  "mayor-sheila-butt": {
    name: "Mayor Sheila Butt",
    location: "Public Figure",
    headline: "Public-facing content management",
    description:
      "Non-political filming, posting, and community engagement.",
  },
};

export default function CaseStudy({ params }: { params: { slug: string } }) {
  const client = CLIENTS[params.slug];

  if (!client) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">Case Study Not Found</h1>
          <Link
            href="/"
            className="inline-block mt-6 rounded-xl bg-emerald-400 px-6 py-3 text-black font-bold"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen animated-bg text-white">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <Link
          href="/#work"
          className="inline-block mb-8 text-sm text-emerald-400"
        >
          ← Back to Work
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold">
          {client.name}
        </h1>

        <p className="mt-2 text-white/60">{client.location}</p>

        <p className="mt-6 text-emerald-400 text-xl font-bold">
          {client.headline}
        </p>

        <div className="mt-6 glass p-6 text-white/75">
          {client.description}
        </div>

        <div className="mt-10">
          <Link
            href="/#contact"
            className="rounded-2xl bg-emerald-400 px-8 py-4 text-black font-extrabold"
          >
            Get Similar Results
          </Link>
        </div>
      </div>
    </main>
  );
}
