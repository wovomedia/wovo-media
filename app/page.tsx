"use client";

// website/src/app/page.tsx
import React, { useMemo, useState } from "react";

const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  url: "https://wovomedia.com",
  email: "Support@wovomedia.com",
  phone: "931-458-3255",
};

const trustedBy = [
  { name: "Campbell Station", note: "Restaurant" },
  { name: "Boot Stompin’ BBQ", note: "Restaurant" },
  { name: "Erwin Heating & Cooling", note: "HVAC" },
  { name: "Liquid Fire Vintage Neon", note: "Retail / Signage" },
  { name: "Local Leadership", note: "Public Figure" },
  { name: "More local businesses", note: "Ongoing" },
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
    note: "We help set up / improve eligibility so clients can earn extra revenue.",
  },
  {
    title: "Lead Capture",
    value: "Systems",
    label: "forms + follow-up that convert",
    note: "Forms, contact workflows, and reporting—built for consistency.",
  },
];

const services = [
  {
    title: "Social Media Management",
    desc: "Consistent posting, community management, and a weekly content system built around growth.",
  },
  {
    title: "Short-Form Editing + Captions",
    desc: "Reels/TikTok-style edits that hold attention and convert into calls, bookings, and sales.",
  },
  {
    title: "Modern Website Builds",
    desc: "Fast, clean websites that explain your offer and capture leads (custom or Shopify when needed).",
  },
  {
    title: "Ads + Lead Capture",
    desc: "Call-driven creative + lead forms + follow-up workflows that make marketing measurable.",
  },
  {
    title: "Reputation + Reviews",
    desc: "Review strategy, Google Business support, and trust-building content that improves conversions.",
  },
  {
    title: "Operations & Systems",
    desc: "Clean processes for clients, editors, and tasks—so delivery stays consistent as you scale.",
  },
];

const workCards = [
  {
    name: "Campbell Station",
    location: "Culleoka, TN",
    live: true,
    links: [
      {
        label: "Facebook",
        url: "https://www.facebook.com/CampbellStationRestaurant/",
      },
      {
        label: "Website",
        url: "https://thecampbellstation.com/",
      },
    ],
  },
  {
    name: "Boot Stompin’ BBQ",
    location: "Columbia, TN",
    live: true,
    links: [
      {
        label: "Facebook",
        url: "https://www.facebook.com/profile.php?id=61569065816720",
      },
      {
        label: "Website",
        url: "https://bootstompinbbq.co/",
      },
    ],
  },
  {
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    live: true,
    links: [
      {
        label: "Facebook",
        url: "https://www.facebook.com/profile.php?id=61585412455842",
      },
    ],
  },
  {
    name: "Dark Knight Contractors",
    location: "Knoxville, TN",
    live: true,
    links: [
      {
        label: "Facebook",
        url: "https://www.facebook.com/profile.php?id=61584182552495",
      },
    ],
  },
  {
    name: "Liquid Fire Vintage Neon",
    location: "Franklin, TN",
    live: true,
    links: [
      {
        label: "Website",
        url: "https://www.liquidfirevintageneon.com/",
      },
      {
        label: "Instagram",
        url: "https://www.instagram.com/liquidfireneon",
      },
      {
        label: "Facebook",
        url: "https://www.facebook.com/liquidfirevn",
      },
    ],
  },
  {
    name: "Mayor Sheila Butt",
    location: "Public Figure",
    live: true,
    links: [
      {
        label: "Official Page",
        url: "https://www.facebook.com/MayorSheilaButt",
      },
      {
        label: "Profile",
        url: "https://www.facebook.com/sheila.k.butt",
      },
    ],
  },
];

function Nav() {
  return (
    <div className="sticky top-0 z-50 bg-black/70 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="#home" className="font-extrabold tracking-tight text-white">
          {BRAND.name}
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-white/80">
          <a className="hover:text-white transition" href="#services">
            Services
          </a>
          <a className="hover:text-white transition" href="#results">
            Results
          </a>
          <a className="hover:text-white transition" href="#process">
            How it works
          </a>
          <a className="hover:text-white transition" href="#work">
            Work
          </a>
          <a className="hover:text-white transition" href="#contact">
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={`sms:${BRAND.phone}`}
            className="hidden sm:inline-flex rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-400/20 transition"
          >
            Text
          </a>
          <a
            href="#contact"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Book a Call
          </a>
        </div>
      </div>
    </div>
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
      <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-white">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-white/70">{subtitle}</p> : null}
    </div>
  );
}

export default function Home() {
  const webhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_LEADS_WEBHOOK_URL || "",
    []
  );

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    if (!webhookUrl) {
      setStatus("error");
      setErrorMsg(
        "Missing webhook URL. Add NEXT_PUBLIC_LEADS_WEBHOOK_URL in .env.local and restart dev server."
      );
      return;
    }

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
      // Google Apps Script web apps often require no-cors from the browser unless you add custom CORS headers.
      // With no-cors, we can't read the response; we treat "request sent" as success and verify via Sheets.
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

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

      {/* HERO */}
      <section id="home" className="relative overflow-hidden">
        {/* Background glow only (cannot block clicks) */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-[520px] w-[520px] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
                {BRAND.legal} • Trusted by 6+ businesses and local people • Nationwide remote-ready
              </p>

              <h1 className="mt-6 text-5xl md:text-6xl font-extrabold leading-tight">
                Build trust online—then convert that attention into customers.
              </h1>

              <p className="mt-6 text-lg text-white/75 max-w-xl">
                We manage social media, edit content, build modern websites, and set up lead capture
                so your marketing produces calls, bookings, and revenue.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="#contact"
                  className="rounded-2xl bg-emerald-400 px-6 py-4 font-bold text-black hover:bg-emerald-300 transition text-center"
                >
                  Request a Custom Plan
                </a>
                <a
                  href={`sms:${BRAND.phone}`}
                  className="rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-6 py-4 font-bold text-emerald-200 hover:bg-emerald-400/20 transition text-center"
                >
                  Call or Text {BRAND.phone}
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Social management",
                  "Short-form editing",
                  "Website builds",
                  "Ads + lead capture",
                  "DM/comment management",
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* HERO CARD */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
              <p className="text-xs font-bold tracking-widest text-white/60">
                CUSTOM PLANS • NO PUBLIC PRICING
              </p>
              <h3 className="mt-3 text-2xl md:text-3xl font-extrabold">
                You don’t need a package—you need a plan.
              </h3>
              <p className="mt-3 text-white/75">
                We scope your workload, goals, and industry, then build a plan you can scale.
                Built to work nationwide (remote) and locally when needed.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Weekly content system",
                  "Editing + captions",
                  "Website conversion upgrades",
                  "Lead capture + follow-up",
                  "Monthly reporting",
                  "Fast turnaround",
                ].map((x) => (
                  <div
                    key={x}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
                  >
                    {x}
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <a
                  href="#contact"
                  className="rounded-2xl bg-white px-6 py-4 text-black font-bold hover:bg-white/90 transition text-center"
                >
                  Get a Custom Plan
                </a>
                <a
                  href={`tel:${BRAND.phone}`}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-4 font-bold text-emerald-200 hover:bg-emerald-400/20 transition text-center"
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
        </div>
      </section>

      {/* TRUSTED BY */}
      <section className="relative z-10 border-y border-white/10 bg-white/5">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold tracking-wide text-white/80">
                Trusted by 6+ businesses and local people
              </p>
              <p className="mt-1 text-xs text-white/55">
                Working clients + ongoing partners. Links and proof below.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full md:w-auto">
              {trustedBy.map((c) => (
                <div
                  key={c.name}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center"
                >
                  <div className="text-sm font-bold text-white">{c.name}</div>
                  <div className="text-xs text-white/55">{c.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="relative z-10 py-14">
        <SectionHeading
          kicker="WHAT WE DO"
          title="Services built for real business growth"
          subtitle="Pick what you need or let us build a plan. We can run everything end-to-end."
        />
        <div className="mx-auto max-w-6xl px-6 mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
              >
                <h3 className="text-lg font-extrabold">{s.title}</h3>
                <p className="mt-2 text-white/75">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS / PROOF */}
      <section
        id="results"
        className="relative z-10 py-14 bg-white/5 border-y border-white/10"
      >
        <SectionHeading
          kicker="RESULTS"
          title="Proof-driven marketing, not vibes"
          subtitle="We focus on outcomes: attention, trust, and conversions (calls, bookings, sales)."
        />

        <div className="mx-auto max-w-6xl px-6 mt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {proofStats.map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-6"
              >
                <div className="text-xs font-bold tracking-widest text-white/60">
                  {p.title.toUpperCase()}
                </div>
                <div className="mt-3 text-4xl font-extrabold">{p.value}</div>
                <div className="mt-1 text-white/80 font-semibold">{p.label}</div>
                <div className="mt-3 text-sm text-white/60">{p.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">
              What that means for your business:
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-white/75">
              {[
                "More visibility (consistent reach)",
                "Better trust (reviews + reputation)",
                "More conversions (calls + leads)",
                "Cleaner systems (delivery + reporting)",
                "Monetization support (Facebook)",
                "Custom plan (no public pricing)",
              ].map((x) => (
                <div
                  key={x}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  {x}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="relative z-10 py-14">
        <SectionHeading
          kicker="HOW IT WORKS"
          title="Simple process. Clear delivery."
          subtitle="We keep it straightforward: discovery, execution, reporting, improvements."
        />
        <div className="mx-auto max-w-6xl px-6 mt-8">
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
              <div
                key={p.step}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-400 text-black font-extrabold">
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

      {/* WORK (links FIXED: z-index + pointer-events) */}
      <section id="work" className="relative z-20 py-14">
        <SectionHeading
          kicker="PORTFOLIO"
          title="See our work in action"
          subtitle="Click any button to view live pages."
        />
        <div className="mx-auto max-w-6xl px-6 mt-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workCards.map((c) => (
              <div
                key={c.name}
                className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-extrabold">{c.name}</div>
                    <div className="text-sm text-white/60">{c.location}</div>
                  </div>

                  {c.live && (
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold border border-emerald-400/30 text-emerald-200">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {c.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 pointer-events-auto cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300 transition"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        className="relative z-10 py-16 bg-white/5 border-t border-white/10"
      >
        <SectionHeading
          kicker="CONTACT"
          title="Request a custom plan"
          subtitle="Fill this out and it will go straight into our lead sheet. You can also call or text."
        />

        <div className="mx-auto max-w-6xl px-6 mt-8">
          <div className="rounded-3xl border border-white/10 bg-black/25 p-8 md:p-10">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <input
                name="name"
                placeholder="Your name"
                required
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="business"
                placeholder="Business name"
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="email"
                placeholder="Email"
                type="email"
                required
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="phone"
                placeholder="Phone"
                required
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="state"
                placeholder="State"
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                name="industry"
                placeholder="Industry (restaurant, HVAC, etc.)"
                className="rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <textarea
                name="needs"
                placeholder="What do you need help with?"
                className="md:col-span-2 h-32 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 placeholder:text-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
              />

              <button
                type="submit"
                disabled={status === "sending"}
                className="md:col-span-2 rounded-2xl bg-emerald-400 px-6 py-4 text-black font-extrabold hover:bg-emerald-300 transition disabled:opacity-60"
              >
                {status === "sending" ? "Sending..." : "Send Request"}
              </button>

              {status === "success" ? (
                <div className="md:col-span-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                  Submitted. We’ll reach out ASAP. If it’s urgent, call or text{" "}
                  <a className="underline" href={`sms:${BRAND.phone}`}>
                    {BRAND.phone}
                  </a>
                  .
                </div>
              ) : null}

              {status === "error" ? (
                <div className="md:col-span-2 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                  Didn’t send. {errorMsg} — you can also call/text{" "}
                  <a className="underline" href={`sms:${BRAND.phone}`}>
                    {BRAND.phone}
                  </a>
                  .
                </div>
              ) : null}

              <div className="md:col-span-2 text-sm text-white/70">
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
      </section>
    </main>
  );
}
