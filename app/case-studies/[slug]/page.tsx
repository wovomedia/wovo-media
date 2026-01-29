import React from "react";
import { notFound } from "next/navigation";

type ClientLink = { label: string; url: string };
type CaseStudy = {
  slug: string;
  name: string;
  location: string;
  tagline?: string;
  highlight?: string;
  summary?: string;
  stats?: Array<{ label: string; value: string }>;
  links: ClientLink[];
};

const BRAND = {
  name: "Wovo Media",
  phone: "931-458-3255",
  email: "Support@wovomedia.com",
};

const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "campbell-station",
    name: "Campbell Station",
    location: "Culleoka, TN",
    highlight: "2,000,000+ views / 28 days",
    tagline: "Restaurant content + community + conversion upgrades",
    summary:
      "We built a consistent content cadence, improved conversion paths, and kept community engagement active so attention turns into real customers.",
    stats: [
      { label: "Views", value: "2,000,000+ / 28 days" },
      { label: "Deliverables", value: "Posting + editing + community + website support" },
    ],
    links: [
      { label: "Facebook", url: "https://www.facebook.com/CampbellStationRestaurant/" },
      { label: "Website", url: "https://thecampbellstation.com/" },
    ],
  },
  {
    slug: "boot-stompin-bbq",
    name: "Boot Stompin’ BBQ",
    location: "Columbia, TN",
    tagline: "Daily posting + promos that drive real visits",
    summary:
      "We focus on clear offers, strong hooks, consistent posting, and simple CTAs that translate into calls, catering inquiries, and foot traffic.",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61569065816720" },
      { label: "Website", url: "https://bootstompinbbq.co/" },
    ],
  },
  {
    slug: "erwin-heating-cooling",
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    tagline: "Call-driven creative + trust-building posts",
    summary:
      "We build call-heavy creative, local trust signals, and consistent posting so people choose you when their system fails.",
    links: [{ label: "Facebook", url: "https://www.facebook.com/profile.php?id=61585412455842" }],
  },
  {
    slug: "dark-knight-contractors",
    name: "Dark Knight Contractors",
    location: "Knoxville, TN",
    tagline: "Modern presence + lead capture foundation",
    summary:
      "We tighten the offer, improve clarity, and connect content to lead capture so visibility becomes booked jobs.",
    links: [{ label: "Facebook", url: "https://www.facebook.com/profile.php?id=61584182552495" }],
  },
  {
    slug: "liquid-fire-vintage-neon",
    name: "Liquid Fire Vintage Neon",
    location: "Franklin, TN",
    tagline: "Brand presence + conversion upgrades",
    summary:
      "We focus on showcasing work, building credibility, and making it easy for customers to inquire and buy.",
    links: [
      { label: "Website", url: "https://www.liquidfirevintageneon.com/" },
      { label: "Instagram", url: "https://www.instagram.com/liquidfireneon" },
      { label: "Facebook", url: "https://www.facebook.com/liquidfirevn" },
    ],
  },
  {
    slug: "mayor-sheila-butt",
    name: "Mayor Sheila Butt",
    location: "Public Figure",
    tagline: "Content planning + posting support",
    summary:
      "We support consistent posting and content organization to maintain a strong, clear public presence.",
    links: [
      { label: "Official Page", url: "https://www.facebook.com/MayorSheilaButt" },
      { label: "Profile", url: "https://www.facebook.com/sheila.k.butt" },
    ],
  },
];

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = CASE_STUDIES.find((x) => x.slug === slug);
  if (!cs) return notFound();

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a href="/" className="font-extrabold tracking-tight">
            {BRAND.name}
          </a>
          <div className="flex gap-2">
            <a
              href={`tel:${BRAND.phone}`}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/10"
            >
              Call
            </a>
            <a
              href={`sms:${BRAND.phone}`}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-emerald-300"
            >
              Text
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <a href="/#work" className="text-sm text-white/70 underline">
          ← Back to case studies
        </a>

        <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">{cs.name}</h1>
        <p className="mt-2 text-white/60">{cs.location}</p>

        {cs.highlight ? (
          <div className="mt-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200">
            {cs.highlight}
          </div>
        ) : null}

        {cs.tagline ? <p className="mt-6 text-lg text-white/80">{cs.tagline}</p> : null}
        {cs.summary ? <p className="mt-3 max-w-3xl text-white/70">{cs.summary}</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-bold tracking-widest text-white/60">LINKS</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {cs.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-bold tracking-widest text-white/60">QUICK STATS</div>
            <div className="mt-4 grid gap-3">
              {(cs.stats?.length ? cs.stats : [{ label: "Status", value: "Active / Ongoing" }]).map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs font-semibold text-white/60">{s.label}</div>
                  <div className="mt-1 font-extrabold text-white">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-lg font-extrabold">Want results like this?</div>
          <p className="mt-2 text-white/70">
            Call or text {BRAND.phone} or email {BRAND.email}. We’ll scope your workload and build a custom plan.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href="/#contact"
              className="rounded-2xl bg-emerald-400 px-6 py-4 text-center font-extrabold text-black hover:bg-emerald-300"
            >
              Request a Plan
            </a>
            <a
              href={`sms:${BRAND.phone}`}
              className="rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-6 py-4 text-center font-extrabold text-emerald-200 hover:bg-emerald-400/20"
            >
              Text Now
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
