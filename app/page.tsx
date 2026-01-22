"use client";

import React, { useMemo, useState, useEffect } from "react";

/* ================= BRAND ================= */
const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  url: "https://wovomedia.com",
  email: "Support@wovomedia.com",
  phone: "931-458-3255",
};

/* ================= DATA ================= */
const proofStats = [
  {
    title: "Campbell Station",
    value: "2,000,000+",
    label: "views every 28 days",
    note: "Rolling 28-day performance",
  },
  {
    title: "Facebook Monetization",
    value: "Enabled",
    label: "additional revenue streams",
    note: "Helping clients qualify & earn",
  },
  {
    title: "Lead Capture",
    value: "Systems",
    label: "forms + follow-up",
    note: "Built for conversion",
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

const workCards = [
  {
    name: "Campbell Station",
    location: "Culleoka, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/CampbellStationRestaurant/" },
      { label: "Website", url: "https://thecampbellstation.com/" },
    ],
  },
  {
    name: "Boot Stompin’ BBQ",
    location: "Columbia, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61569065816720" },
      { label: "Website", url: "https://bootstompinbbq.co/" },
    ],
  },
  {
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61585412455842" },
    ],
  },
];

/* ================= NAV ================= */
function Nav() {
  return (
    <div className="sticky top-0 z-50 bg-black/70 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-4 flex justify-between items-center">
        <a href="#home" className="font-extrabold text-white">{BRAND.name}</a>
        <nav className="hidden md:flex gap-6 text-sm text-white/80">
          <a href="#services">Services</a>
          <a href="#results">Results</a>
          <a href="#process">Process</a>
          <a href="#work">Work</a>
          <a href="#contact">Contact</a>
        </nav>
        <a href="#contact" className="bg-white text-black px-4 py-2 rounded-xl font-bold">
          Book a Call
        </a>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */
export default function Home() {
  const webhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_LEADS_WEBHOOK_URL || "",
    []
  );

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  /* ===== Scroll Animation Hook ===== */
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add("reveal-visible");
        });
      },
      { threshold: 0.15 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const fd = new FormData(e.currentTarget);

    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });

    setStatus("success");
    e.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-black text-white">

      <Nav />

      {/* ================= HERO ================= */}
      <section id="home" className="relative animated-gradient overflow-hidden">
        <div className="glow glow-primary absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2" />
        <div className="absolute inset-0 bg-grid opacity-40" />

        <div className="relative max-w-6xl mx-auto px-6 py-28 grid md:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
              Build trust online.<br />
              <span className="gradient-text">Convert attention into customers.</span>
            </h1>
            <p className="mt-6 text-white/75 max-w-xl">
              Social media, content, websites, and lead systems built to produce calls and revenue.
            </p>

            <div className="mt-8 flex gap-4">
              <a href="#contact" className="btn-primary px-6 py-4 rounded-2xl">
                Request a Custom Plan
              </a>
              <a href={`sms:${BRAND.phone}`} className="btn-ghost px-6 py-4 rounded-2xl">
                Call / Text
              </a>
            </div>
          </div>

          <div className="card reveal p-8 rounded-3xl">
            <p className="text-sm text-white/70">
              Trusted by real businesses. No public pricing. Custom plans only.
            </p>
          </div>
        </div>
      </section>

      {/* ================= TRUST LOGOS ================= */}
      <section className="py-12 border-y border-white/10 bg-black/50">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm text-white/70 mb-6">
            Trusted by real businesses & local leaders
          </p>
          <div className="flex flex-wrap justify-center gap-10 opacity-80">
            {["/logos/campbell-station.png","/logos/boot-stompin.png","/logos/erwin-hvac.png"].map(src => (
              <img key={src} src={src} className="h-10 grayscale hover:grayscale-0 transition" />
            ))}
          </div>
        </div>
      </section>

      {/* ================= SERVICES ================= */}
      <section id="services" className="py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
          {services.map(s => (
            <div key={s.title} className="card reveal p-6 rounded-3xl">
              <h3 className="font-extrabold text-lg">{s.title}</h3>
              <p className="mt-2 text-white/75">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= RESULTS ================= */}
      <section id="results" className="py-20 bg-white/5">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
          {proofStats.map(p => (
            <div key={p.title} className="card reveal p-6 rounded-3xl">
              <p className="text-sm text-white/60">{p.title}</p>
              <p className="text-4xl font-extrabold gradient-text mt-2">{p.value}</p>
              <p className="text-white/80">{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= WORK ================= */}
      <section id="work" className="py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
          {workCards.map(w => (
            <div key={w.name} className="card reveal p-6 rounded-3xl">
              <h3 className="font-extrabold">{w.name}</h3>
              <p className="text-sm text-white/60">{w.location}</p>
              <div className="mt-4 flex gap-2 flex-wrap">
                {w.links.map(l => (
                  <a key={l.url} href={l.url} target="_blank"
                     className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact" className="py-24 bg-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <form onSubmit={handleSubmit} className="card reveal p-8 rounded-3xl grid gap-4">
            <input name="name" required placeholder="Your name" className="input" />
            <input name="email" required placeholder="Email" className="input" />
            <input name="phone" required placeholder="Phone" className="input" />
            <textarea name="needs" placeholder="What do you need help with?" className="input h-32" />
            <button className="btn-primary py-4 rounded-xl">
              {status === "sending" ? "Sending..." : "Send Request"}
            </button>
          </form>
        </div>
      </section>

      {/* ================= MOBILE CTA ================= */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 flex">
        <a href={`tel:${BRAND.phone}`} className="w-1/2 py-4 bg-emerald-500 text-center font-bold">
          Call
        </a>
        <a href={`sms:${BRAND.phone}`} className="w-1/2 py-4 bg-black text-emerald-400 text-center font-bold">
          Text
        </a>
      </div>

    </main>
  );
}
