"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* =====================
   BRAND
===================== */
const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  phone: "931-458-3255",
};

/* =====================
   CLIENTS (RESTORED)
===================== */
const clients = [
  {
    slug: "campbell-station",
    name: "Campbell Station",
    location: "Culleoka, TN",
    stats: "2M+ views / 28 days",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/CampbellStationRestaurant/" },
      { label: "Website", url: "https://thecampbellstation.com/" },
    ],
  },
  {
    slug: "boot-stompin-bbq",
    name: "Boot Stompin’ BBQ",
    location: "Columbia, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61569065816720" },
      { label: "Website", url: "https://bootstompinbbq.co/" },
    ],
  },
  {
    slug: "erwin-heating",
    name: "Erwin Heating & Cooling",
    location: "Columbia, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61585412455842" },
    ],
  },
  {
    slug: "dark-knight",
    name: "Dark Knight Contractors",
    location: "Knoxville, TN",
    links: [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61584182552495" },
    ],
  },
  {
    slug: "liquid-fire",
    name: "Liquid Fire Vintage Neon",
    location: "Franklin, TN",
    links: [
      { label: "Website", url: "https://www.liquidfirevintageneon.com/" },
      { label: "Instagram", url: "https://www.instagram.com/liquidfireneon" },
    ],
  },
  {
    slug: "mayor-sheila-butt",
    name: "Mayor Sheila Butt",
    location: "Public Figure",
    links: [
      { label: "Official Page", url: "https://www.facebook.com/MayorSheilaButt" },
    ],
  },
];

/* =====================
   SCROLL REVEAL
===================== */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      entries =>
        entries.forEach(e => e.isIntersecting && e.target.classList.add("show")),
      { threshold: 0.15 }
    );
    els.forEach(el => observer.observe(el));
  }, []);
}

/* =====================
   PAGE
===================== */
export default function Home() {
  useReveal();

  return (
    <main className="animated-bg min-h-screen text-white">

      {/* NAV */}
      <nav className="sticky top-0 z-40 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <span className="font-extrabold">{BRAND.name}</span>
          <Link href="#contact" className="btn-primary">Book a Call</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12">
        <div className="reveal">
          <h1 className="text-5xl md:text-6xl font-extrabold">
            Build trust online.<br />
            <span className="text-emerald-400">Convert attention into customers.</span>
          </h1>

          <p className="mt-6 text-white/70">
            Social media, websites, and lead systems built to produce calls and revenue.
          </p>

          <div className="mt-8 flex gap-4">
            <Link href="#contact" className="btn-primary">Request a Plan</Link>
            <a href={`sms:${BRAND.phone}`} className="btn-outline">Call / Text</a>
          </div>
        </div>

        <div className="glass p-8 reveal">
          <p className="text-sm text-white/60">
            Trusted by real businesses. 2M+ views generated.
          </p>
        </div>
      </section>

      {/* SERVICES */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold mb-10 reveal">Services</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            "Social Media Management",
            "Short-Form Editing",
            "Website Builds",
            "Ads + Lead Capture",
            "Reputation & Reviews",
            "Operations & Systems",
          ].map(s => (
            <div key={s} className="glass p-6 reveal">
              <h3 className="font-bold">{s}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* WORK / CASE STUDIES */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold mb-10 reveal">Case Studies</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {clients.map(c => (
            <Link
              key={c.slug}
              href={`/case-studies/${c.slug}`}
              className="glass p-6 hover:scale-[1.02] transition reveal"
            >
              <h3 className="font-bold">{c.name}</h3>
              <p className="text-sm text-white/60">{c.location}</p>
              {c.stats && (
                <p className="mt-2 text-emerald-400 text-sm">{c.stats}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-extrabold mb-8 reveal">Request a Custom Plan</h2>

        <form className="glass p-8 grid gap-4 max-w-xl reveal">
          <input placeholder="Name" className="p-3 rounded bg-black/40 border border-white/10" />
          <input placeholder="Email" className="p-3 rounded bg-black/40 border border-white/10" />
          <textarea placeholder="What do you need help with?" className="p-3 rounded bg-black/40 border border-white/10" />
          <button className="btn-primary">Send Request</button>
        </form>
      </section>

      {/* MOBILE CTA */}
      <div className="mobile-cta md:hidden flex justify-around py-3">
        <a href={`tel:${BRAND.phone}`} className="btn-primary">Call</a>
        <a href={`sms:${BRAND.phone}`} className="btn-outline">Text</a>
      </div>

    </main>
  );
}
