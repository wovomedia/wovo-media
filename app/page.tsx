"use client";

import React, { useEffect, useState } from "react";

/**
 * HOME PAGE
 * - Proven growth snapshot cards
 * - Scroll reveal animations (IntersectionObserver)
 * - Sticky mobile Call/Text bar
 * - Animated emerald gradient background (pure CSS via utility classes + inline styles)
 * - Form posts to /api/lead (server forwards to Google Sheets webhook)
 */

const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  url: "https://wovomedia.com",
  email: "Support@wovomedia.com",
  phone: "931-458-3255",
};

type ResultCard = {
  label: string;
  metric: string;
  detail: string;
};

const provenResults: ResultCard[] = [
  {
    label: "Restaurant Campaigns",
    metric: "10M monthly views total",
    detail: "Consistent short-form posting across local restaurant brands.",
  },
  {
    label: "HVAC / Contractor Campaigns",
    metric: "2M+ monthly views",
    detail: "Campaign systems producing 50+ extra calls per week.",
  },
  {
    label: "Government Trust",
    metric: "Trusted by TN officials",
    detail: "Established relationships with government officials in Tennessee.",
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
  {
    title: "Drone Content & Aerial Shoots",
    desc: "Drone footage for properties, jobsites, and brand storytelling with licensed pilots.",
  },
];

const proofStats = [
  {
    title: "Nationwide Reach",
    value: "All 50 States",
    label: "serving businesses coast-to-coast",
    note: "Nationwide digital growth for local businesses.",
  },
  {
    title: "Lead Capture",
    value: "Always-On",
    label: "forms + follow-up that convert",
    note: "Conversion-focused workflows and reporting.",
  },
  {
    title: "Content Velocity",
    value: "Weekly",
    label: "consistent short-form output",
    note: "Content systems that compound reach.",
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


function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#home" className="font-extrabold tracking-tight text-white">
          {BRAND.name}
        </a>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/80 md:flex">
          <a className="transition hover:text-white" href="/wovo-ai">
            Wovo AI
          </a>
          <a className="transition hover:text-white" href="#services">
            Services
          </a>
          <a className="transition hover:text-white" href="#results">
            Results
          </a>
          <a className="transition hover:text-white" href="#process">
            Process
          </a>
          <a className="transition hover:text-white" href="#growth">
            Proven Growth
          </a>
          <a className="transition hover:text-white" href="#about">
            About
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
    const name = String(fd.get("name") || "").trim();
    const business = String(fd.get("business") || "").trim();
    const company = String(fd.get("company") || "");
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const state = String(fd.get("state") || "").trim();
    const industry = String(fd.get("industry") || "").trim();
    const needs = String(fd.get("needs") || "").trim();

    if (company) {
      setStatus("error");
      setErrorMsg("Unable to submit. Please try again.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!name || !business || !phone || !state || !industry || !needs) {
      setStatus("error");
      setErrorMsg("Please complete all required fields.");
      return;
    }

    const payload = {
      name,
      business,
      email,
      phone,
      state,
      industry,
      needs,
      timestamp: new Date().toISOString(),
      source: "wovomedia.com",
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
              Social media, content, websites, and lead systems built to produce calls and revenue. Serving businesses
              in all 50 states.
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
              Packages built for your workload.
            </h3>
            <p className="mt-3 text-white/75">
              We scope your goals and industry, then build the right package for what you need—from remote content systems
              to monthly fly-out production days for on-site filming.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Weekly content cadence",
                "Editing + captions",
                "Website conversion upgrades",
                "Lead capture + follow-up",
                "Monthly reporting",
                "Drone footage available",
                "Optional monthly fly-outs",
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

      {/* PROVEN GROWTH */}
      <section className="border-y border-white/10 bg-white/5">
        <div className="mx-auto max-w-6xl px-6 py-10" data-reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-wide text-white/85">Proven growth snapshots</p>
              <p className="mt-1 text-xs text-white/55">Serving businesses in all 50 states.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {provenResults.map((result) => (
              <div key={result.label} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{result.label}</div>
                <div className="mt-3 text-2xl font-extrabold text-emerald-300">{result.metric}</div>
                <div className="mt-2 text-sm text-white/65">{result.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-14">
        <SectionHeading
          kicker="SERVICES"
          title="Built to generate attention — and convert it"
          subtitle="You can pick what you need—from monthly fly-outs to full-service management—or we can build it end-to-end."
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
            Serving businesses in all 50 states • Nationwide digital growth for local businesses • Flexible packages
          </p>
        </div>
      </section>

      {/* PROVEN GROWTH */}
      <section id="growth" className="border-y border-white/10 bg-white/5 py-14">
        <SectionHeading
          kicker="PROVEN GROWTH"
          title="Anonymized results across industries"
          subtitle="Metrics-only outcomes from recent campaigns."
        />
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {provenResults.map((result) => (
              <div
                key={result.label}
                data-reveal
                className="rounded-3xl border border-white/10 bg-black/20 p-6"
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{result.label}</div>
                <div className="mt-3 text-2xl font-extrabold text-emerald-300">{result.metric}</div>
                <div className="mt-2 text-sm text-white/70">{result.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-14">
        <SectionHeading
          kicker="ABOUT"
          title="About Wovo Media"
          subtitle="Serving businesses in all 50 states with nationwide digital growth for local businesses."
        />
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div data-reveal className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white/70">Who we are</div>
              <h3 className="mt-3 text-2xl font-extrabold text-white">Built for outcomes, not vanity metrics.</h3>
              <p className="mt-3 text-white/70">
                Wovo Media helps local businesses win attention and turn it into measurable growth. We focus on
                consistent content, conversion-focused websites, and lead systems that drive calls and revenue—no matter
                where you operate.
              </p>
            </div>

            <div data-reveal className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <div className="text-sm font-semibold text-white/70">Leadership</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-extrabold text-white">Payton Cody</div>
                  <div className="text-sm text-white/65">CEO, Founder of Wovo Media</div>
                  <a className="mt-2 block text-sm font-semibold text-emerald-200" href="mailto:Payton@wovomedia.com">
                    Payton@wovomedia.com
                  </a>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-extrabold text-white">Austin Cody</div>
                  <div className="text-sm text-white/65">Head of Operations</div>
                  <a className="mt-2 block text-sm font-semibold text-emerald-200" href="mailto:Austin.cody@wovomedia.com">
                    Austin.cody@wovomedia.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-16">
        <SectionHeading
          kicker="CONTACT"
          title="Get pricing for your market"
          subtitle="Serving all 50 states — now working with businesses nationwide."
        />

        <div className="mx-auto mt-8 max-w-6xl px-6">
          <div data-reveal className="rounded-3xl border border-white/10 bg-black/25 p-8 md:p-10">
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Serving businesses in all 50 states. Nationwide digital growth for local businesses.
            </div>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <input
                name="name"
                placeholder="Full name"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="business"
                placeholder="Business"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="email"
                placeholder="Email address"
                type="email"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="phone"
                placeholder="Phone number"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="state"
                placeholder="State"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="industry"
                placeholder="Industry"
                required
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <textarea
                name="needs"
                placeholder="What do you need help with?"
                required
                rows={4}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400 md:col-span-2"
              />
              <input name="company" tabIndex={-1} autoComplete="off" className="hidden" />

              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-2xl bg-emerald-400 px-6 py-4 font-extrabold text-black transition hover:bg-emerald-300 disabled:opacity-60 md:col-span-2"
              >
                {status === "sending" ? "Sending..." : "Get pricing"}
              </button>

              {status === "success" ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200 md:col-span-2">
                  Thanks! We’ll send pricing details shortly. If it’s urgent, call or text{" "}
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
