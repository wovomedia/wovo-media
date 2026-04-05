import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { brand } from "@/data/site-content";

export function ClosingCtaSection() {
  return (
    <section className="border-y border-slate-200 bg-slate-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="rounded-3xl border border-white/15 bg-white/5 p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {["🔒 Licensed & Insured","🚁 Drone Certified","⏰ 24/7 Support","✈️ Nationwide"].map(b => (
              <span key={b} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">{b}</span>
            ))}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to grow your business?
          </h2>
          <p className="mt-3 max-w-2xl text-base text-slate-300">
            Start with a free 1-hour strategy call, try Wovo AI for 7 days free, or kick things off with our $150 7-day paid content test. Every type of business welcome.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button href="/contact" size="lg">
              📅 Book a Free 1-Hour Call
            </Button>
            <Button href="/wovo-ai" size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              ✨ Try Wovo Media AI — 7 Days Free
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Questions? Call or text{" "}
            <a className="font-semibold text-white underline" href={`tel:${brand.phone}`}>{brand.phoneDisplay}</a>
            {" "}or email{" "}
            <a className="font-semibold text-white underline" href={`mailto:${brand.email}`}>{brand.email}</a>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
