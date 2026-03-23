import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { brand } from "@/data/site-content";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(0,233,145,0.15),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_38%),var(--wm-page)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
        <FadeIn className="space-y-6">
          <p className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            AI and agency growth system
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Content and AI that get restaurants more customers.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600">
            Use our AI tools yourself, or have our team handle content, ads, and conversion pages for you.
            {` `}
            {brand.reach.toLowerCase()} and we can fly out for on-site filming.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/wovo-ai" size="lg">
              Try Wovo AI
            </Button>
            <Button href="/services" size="lg" variant="outline">
              Hire Wovo Media
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
              DIY: starts at $49/mo
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
              Done-for-you: from $600/mo
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
              7-day paid test: $150
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,36,0.10)]">
            {/* TODO: Replace these placeholder visuals with real campaign screenshots and on-site restaurant photos. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Image
                  src="/images/hero-restaurant.svg"
                  alt="Restaurant video content preview placeholder"
                  width={720}
                  height={400}
                  className="h-44 w-full rounded-2xl border border-slate-200 object-cover"
                  priority
                />
              </div>
              <Image
                src="/images/hero-ai.svg"
                alt="Wovo AI dashboard placeholder"
                width={360}
                height={220}
                className="h-32 w-full rounded-2xl border border-slate-200 object-cover"
              />
              <Image
                src="/images/hero-mobile.svg"
                alt="Mobile social media preview placeholder"
                width={360}
                height={220}
                className="h-32 w-full rounded-2xl border border-slate-200 object-cover"
              />
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Serving businesses across the USA</p>
              <p className="mt-1 text-sm text-slate-700">
                Founder-led support, clear reporting, and fast implementation for busy owners.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
