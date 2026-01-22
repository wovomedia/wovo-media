"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * HOME PAGE
 * - Trusted by logo row (with fallback pills if logo missing)
 * - Case study cards link to /case-studies/[slug]
 * - Scroll reveal animations (IntersectionObserver)
 * - Sticky mobile Call/Text bar
 * - Animated emerald gradient background (pure CSS via utility classes + inline styles)
 * - Form posts to /api/lead (server route) so Google Sheets works reliably
 */

const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  url: "https://wovomedia.com",
  email: "Support@wovomedia.com",
  phone: "931-458-3255",
};

// Put logo files in: website/public/logos/...
// If a logo src is missing, the UI will render a fallback pill.
const trustedLogos: Array<{ name: string; src?: string; alt?: string }> = [
  { name: "Campbell Station", src: "/logos/campbell-station.png", alt: "Campbell Station" },
  { name: "Boot Stompin’ BBQ", src: "/logos/boot-stompin.png", alt: "Boot Stompin’ BBQ" },
  { name: "Erwin Heating & Cooling", src: "/logos/erwin.png", alt: "Erwin Heating & Cooling" },
  { name: "Liquid Fire Vintage Neon", src: "/logos/liquid-fire.png", alt: "Liquid Fire Vintage Neon" },
  { name: "Dark Knight Contractors", src: "/logos/dark-knight.png", alt: "Dark Knight Contractors" },
  // If you don't have a logo, omit src and it will render text.
  { name: "Mayor Sheila Butt", src: undefined, alt: "Mayor Sheila Butt" },
];

type ClientLink = { label: string; url: string };
type CaseStudy = {
  slug: string;
  name: string;
  location: string;
  tagline?: string;
  highlight?: string;
  stats?: Array<{ label: string; value: string }>;
  links: ClientLink[];
};

const caseStudies: CaseStudy[] = [
  {
    slug: "campbell-station",
    name: "Campbell Station",
    location: "Culleoka, TN",
    tagline: "Restaurant growth systems + content pipeline",
    highlight: "2M+ views / 28 days",
    stats: [
      { label: "Views", value: "2,000,000+ / 28 days" },
      { label: "Focus", value: "Short-form + community + conversion" },
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
    tagline: "Daily posts + promos + local awareness",
    highlight: "Restaurant content + offers that convert",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61569065816720" },
      { label: "Website", url: "https://bootstompinbbq.co/" },
    ],
  },
  {
    slug: "erwin-heating-cooling",
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    tagline: "Call-driven ads + trust content",
    highlight: "Lead-focused messaging",
    links: [{ label: "Facebook", url: "https://www.facebook.com/profile.php?id=61585412455842" }],
  },
  {
    slug: "dark-knight-contractors",
    name: "Dark Knight Contractors",
    location: "Knoxville, TN",
    tagline: "Social presence + lead capture foundation",
    links: [{ label: "Facebook", url: "https://www.facebook.com/profile.php?id=61584182552495" }],
  },
  {
    slug: "liquid-fire-vintage-neon",
    name: "Liquid Fire Vintage Neon",
    location: "Franklin, TN",
    tagline: "Brand presence + conversion upgrades",
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
    links: [
      { label: "Official Page", url: "https://www.facebook.com/MayorSheilaButt" },
      { label: "Profile", url: "https://www.facebook.com/sheila.k.butt" },
    ],
  },
];

const services = [
  {
    title: "Social Media Management",
    desc: "Consistent posting, growth strategy, and comment/DM management.",
  },
  {
    title: "Short-Form Editing",
    desc: "Reels & TikToks designed to hold attention and drive action.",
  },
  {
    title: "Website Builds",
    desc: "Modern, fast websites that convert traffic into leads.",
  },
  {
    title: "Ads + Lead Capture",
    desc: "Call-driven ads, forms, and follow-up systems.",
  },
  {
    title: "Reputation & Reviews",
    desc: "Trust-building systems that increase conversions.",
  },
  {
    title: "Operations & Systems",
    desc: "Clean workflows for scale and consistency.",
  },
];

const proofStats = [
  {
    title: "Campbell Station",
    value: "2,000,000+",
    label: "views every 28 days",
    note: "Recent performance (rolling 28-day periods).",
  },
  {
    title: "Facebook Monetization",
    value: "Enablement",
    label: "helping clients get monetized",
    note: "We help set up and improve eligibility so clients can earn extra revenue.",
  },
  {
    title: "Lead Capture",
    value: "Systems",
    label: "forms + follow-up that convert",
    note: "Forms, contact workflows, and reporting—built for consistency.",
  },
];

/** Scroll reveal hook (no libraries) */
function useRevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "true";
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "80px" }
    );

    nodes.forEach((n) => io.observe(n));

    return () => io.disconnect();
  }, []);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#home" className="font-extrabold tracking-tight text-white">
          {BRAND.name}
        </a>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/80 md:flex">
          <a className="transition hover:text-white" href="#services">
            Services
          </a>
          <a className="transition hover:text-white" href="#results">
            Results
          </a>
          <a className="transition hover:text-white" href="#process">
            Process
          </a>
          <a className="transition hover:text-white" href="#work">
            Case Studies
          </a>
          <a className="transition hover:text-white" href="#contact">
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={`sms:${BRAND.phone}`}
            className="hidden rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 sm:inline-flex"
          >
            Text
          </a>
          <a
            href="#contact"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-extrabold text-black transition hover:bg-emerald-300"
          >
            Book a Call
          </a>
        </div>
      </div>
    </header>
  );
}

function SectionHeading({
  kicker,
  title,
  subtitle,
  id,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div id={id} className="mx-auto max-w-6xl px-6">
      {kicker ? (
        <p className="text-xs font-bold tracking-widest text-white/60">{kicker}</p>
      ) : null}
      <h2 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-white/70">{subtitle}</p> : null}
    </div>
  );
}

function TrustedLogo({ name, src, alt }: { name: string; src?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80">
        {name}
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || name}
        className="h-6 w-auto opacity-90"
        onError={() => setBroken(true)}
        loading="lazy"
      />
    </div>
  );
}

/** Sticky mobile CTA bar */
function MobileCtaBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] md:hidden">
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <div className="pointer-events-auto grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <a
            href={`tel:${BRAND.phone}`}
            className="flex items-center justify-center gap-2 px-4 py-4 text-sm font-extrabold text-white"
          >
            Call
          </a>
          <a
            href={`sms:${BRAND.phone}`}
            className="flex items-center justify-center gap-2 bg-emerald-400 px-4 py-4 text-sm font-extrabold text-black"
          >
            Text
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  useRevealOnScroll();

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      name: String(fd.get("name") || ""),
      business: String(fd.get("business") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      state: String(fd.get("state") || ""),
      industry: String(fd.get("industry") || ""),
      needs: String(fd.get("needs") || ""),
      source: "wovomedia.com",
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setStatus("success");
      form.reset();
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Failed to submit. Try again.");
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Nav />
      <MobileCtaBar />

      {/* Animated emerald gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(900px 600px at 20% 15%, rgba(16,185,129,0.32), rgba(0,0,0,0) 55%), radial-gradient(800px 600px at 80% 35%, rgba(16,185,129,0.22), rgba(0,0,0,0) 60%), radial-gradient(900px 700px at 50% 90%, rgba(16,185,129,0.16), rgba(0,0,0,0) 60%)",
            filter: "blur(0px)",
            animation: "wovoFloat 10s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "linear-gradient(120deg, rgba(16,185,129,0.12), rgba(0,0,0,0) 35%, rgba(16,185,129,0.10))",
            animation: "wovoSweep 14s linear infinite",
            mixBlendMode: "screen",
          }}
        />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(circle at 50% 20%, black 0%, transparent 60%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 20%, black 0%, transparent 60%)",
          }}
        />
        <style>{`
          @keyframes wovoFloat {
            from { transform: translate3d(0,0,0) scale(1); opacity: 0.55; }
            to { transform: translate3d(0,-18px,0) scale(1.03); opacity: 0.70; }
          }
          @keyframes wovoSweep {
            0% { transform: translateX(-10%); }
            100% { transform: translateX(10%); }
          }
          /* Scroll reveal */
          [data-reveal] {
            opacity: 0;
            transform: translateY(18px);
            transition: opacity 700ms ease, transform 700ms ease;
          }
          [data-reveal][data-revealed="true"] {
            opacity: 1;
            transform: translateY(0);
          }
        `}</style>
      </div>

      {/* HERO */}
      <section id="home" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
          <div data-reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
              {BRAND.legal} • Trusted by real businesses • Custom plans only
            </p>

            <h1 className="mt-6 text-5xl font-extrabold leading-tight md:text-6xl">
              Build trust online.
              <span className="block text-emerald-300">Convert attention into customers.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-white/75">
              Social media, content, websites, and lead systems built to produce calls and revenue.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contact"
                className="rounded-2xl bg-emerald-400 px-6 py-4 text-center font-extrabold text-black transition hover:bg-emerald-300"
              >
                Request a Plan
              </a>
              <a
                href={`sms:${BRAND.phone}`}
                className="rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-6 py-4 text-center font-extrabold text-emerald-200 transition hover:bg-emerald-400/20"
              >
                Call / Text
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {["Content system", "Editing", "Website conversion", "Lead capture", "DM management"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* HERO RIGHT CARD */}
          <div data-reveal className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.35)] md:p-10">
            <p className="text-xs font-bold tracking-widest text-white/60">NO PUBLIC PRICING • CUSTOM PLAN</p>
            <h3 className="mt-3 text-2xl font-extrabold md:text-3xl">
              A plan built for your workload.
            </h3>
            <p className="mt-3 text-white/75">
              We scope your goals and industry, then build a plan that produces calls, bookings, and consistent growth.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Weekly content cadence",
                "Editing + captions",
                "Website conversion upgrades",
                "Lead capture + follow-up",
                "Monthly reporting",
                "Fast turnaround",
              ].map((x) => (
                <div key={x} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                  {x}
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contact"
                className="rounded-2xl bg-white px-6 py-4 text-center font-extrabold text-black transition hover:bg-white/90"
              >
                Get a Custom Plan
              </a>
              <a
                href={`tel:${BRAND.phone}`}
                className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-4 text-center font-extrabold text-emerald-200 transition hover:bg-emerald-400/20"
              >
                Call Now
              </a>
            </div>

            <p className="mt-3 text-xs text-white/55">
              Prefer text?{" "}
              <a className="underline" href={`sms:${BRAND.phone}`}>
                Text {BRAND.phone}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* TRUSTED BY (LOGOS) */}
      <section className="border-y border-white/10 bg-white/5">
        <div className="mx-auto max-w-6xl px-6 py-10" data-reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-wide text-white/85">
                Trusted by real businesses & local leaders
              </p>
              <p className="mt-1 text-xs text-white/55">
                Logos load from <span className="font-semibold">/public/logos</span>. Missing logos fallback to text.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 md:w-auto">
              {trustedLogos.map((l) => (
                <TrustedLogo key={l.name} name={l.name} src={l.src} alt={l.alt} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-14">
        <SectionHeading
          kicker="SERVICES"
          title="Built to generate attention — and convert it"
          subtitle="You can pick what you need, or we can build the full plan end-to-end."
        />
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.title}
                data-reveal
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
              >
                <h3 className="text-lg font-extrabold">{s.title}</h3>
                <p className="mt-2 text-white/75">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section id="results" className="border-y border-white/10 bg-white/5 py-14">
        <SectionHeading
          kicker="RESULTS"
          title="Proof-driven marketing"
          subtitle="We track outcomes: reach, trust, and conversions (calls, bookings, sales)."
        />

        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {proofStats.map((p) => (
              <div
                key={p.title}
                data-reveal
                className="rounded-3xl border border-white/10 bg-black/20 p-6"
              >
                <div className="text-xs font-bold tracking-widest text-white/60">{p.title.toUpperCase()}</div>
                <div className="mt-3 text-4xl font-extrabold text-emerald-300">{p.value}</div>
                <div className="mt-1 font-semibold text-white/85">{p.label}</div>
                <div className="mt-3 text-sm text-white/60">{p.note}</div>
              </div>
            ))}
          </div>

          <div data-reveal className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">What that means for you:</div>
            <div className="mt-2 grid gap-2 text-sm text-white/75 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "More visibility (consistent reach)",
                "Better trust (reviews + credibility)",
                "More conversions (calls + leads)",
                "Clean systems (delivery + reporting)",
                "Monetization support (Facebook)",
                "Custom plan (no public pricing)",
              ].map((x) => (
                <div key={x} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  {x}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="py-14">
        <SectionHeading
          kicker="PROCESS"
          title="Simple, fast, consistent"
          subtitle="Discovery → execution → optimization. Clear steps, clean delivery."
        />
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Discovery + goals",
                desc: "We learn your offer, audience, and what “winning” looks like for your business.",
              },
              {
                step: "2",
                title: "Build + execute",
                desc: "We create content, edit, post, and improve your website to convert attention into leads.",
              },
              {
                step: "3",
                title: "Optimize + scale",
                desc: "We review performance, double down on what works, and scale the winners.",
              },
            ].map((p) => (
              <div key={p.step} data-reveal className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 font-extrabold text-black">
                  {p.step}
                </div>
                <h3 className="mt-4 text-xl font-extrabold">{p.title}</h3>
                <p className="mt-2 text-white/75">{p.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-white/65">
            Nationwide remote service • On-site available when needed • Custom plans
          </p>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section id="work" className="border-y border-white/10 bg-white/5 py-14">
        <SectionHeading
          kicker="CASE STUDIES"
          title="Click a client to view the details"
          subtitle="Each page includes links to their live channels and what we did."
        />
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {caseStudies.map((c) => (
              <a
                key={c.slug}
                href={`/case-studies/${c.slug}`}
                data-reveal
                className="group rounded-3xl border border-white/10 bg-black/20 p-6 transition hover:border-emerald-400/30 hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-extrabold">{c.name}</div>
                    <div className="text-sm text-white/60">{c.location}</div>
                  </div>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">
                    VIEW
                  </span>
                </div>

                {c.highlight ? (
                  <div className="mt-3 text-sm font-semibold text-emerald-300">{c.highlight}</div>
                ) : null}
                {c.tagline ? <div className="mt-2 text-sm text-white/70">{c.tagline}</div> : null}

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  Open case study <span className="transition group-hover:translate-x-1">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-16">
        <SectionHeading
          kicker="CONTACT"
          title="Request a custom plan"
          subtitle="This will save into your lead sheet again (via /api/lead)."
        />

        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div data-reveal className="rounded-3xl border border-white/10 bg-black/25 p-8 md:p-10">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <input
                name="name"
                placeholder="Your name"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="business"
                placeholder="Business name"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="email"
                placeholder="Email"
                type="email"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="phone"
                placeholder="Phone"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="state"
                placeholder="State"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="industry"
                placeholder="Industry (restaurant, HVAC, etc.)"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <textarea
                name="needs"
                placeholder="What do you need help with?"
                className="h-32 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400 md:col-span-2"
              />

              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-2xl bg-emerald-400 px-6 py-4 font-extrabold text-black transition hover:bg-emerald-300 disabled:opacity-60 md:col-span-2"
              >
                {status === "sending" ? "Sending..." : "Send Request"}
              </button>

              {status === "success" ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200 md:col-span-2">
                  Submitted. We’ll reach out ASAP. If it’s urgent, call or text{" "}
                  <a className="underline" href={`sms:${BRAND.phone}`}>
                    {BRAND.phone}
                  </a>
                  .
                </div>
              ) : null}

              {status === "error" ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200 md:col-span-2">
                  Didn’t send. {errorMsg} — you can also call/text{" "}
                  <a className="underline" href={`sms:${BRAND.phone}`}>
                    {BRAND.phone}
                  </a>
                  .
                </div>
              ) : null}

              <div className="text-sm text-white/70 md:col-span-2">
                Or email{" "}
                <a className="underline" href={`mailto:${BRAND.email}`}>
                  {BRAND.email}
                </a>{" "}
                • Call{" "}
                <a className="underline" href={`tel:${BRAND.phone}`}>
                  {BRAND.phone}
                </a>{" "}
                • Text{" "}
                <a className="underline" href={`sms:${BRAND.phone}`}>
                  {BRAND.phone}
                </a>
              </div>
            </form>
          </div>

          <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/55">
            © {new Date().getFullYear()} {BRAND.legal} •{" "}
            <a className="underline" href={BRAND.url} target="_blank" rel="noreferrer">
              {BRAND.url.replace("https://", "")}
            </a>
          </footer>
        </div>

        {/* Spacer so the mobile sticky bar doesn't cover footer */}
        <div className="h-20 md:hidden" />
      </section>
    </main>
  );
}
