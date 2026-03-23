import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { brand } from "@/data/site-content";

export function ClosingCtaSection() {
  return (
    <section className="border-y border-slate-200 bg-slate-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="rounded-3xl border border-white/15 bg-white/5 p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Ready to grow</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Start with Wovo AI or book the full team.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-slate-300">
            Choose the path that fits your current bandwidth. You can always upgrade as your business scales.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button href="/wovo-ai" size="lg">
              Start Wovo AI - $49/mo
            </Button>
            <Button href="/contact" size="lg" variant="outline" className="border-white/35 bg-transparent text-white hover:bg-white/10">
              Book a Call
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Prefer to talk first? Call or text{" "}
            <a className="font-semibold text-white underline" href={`tel:${brand.phone}`}>
              {brand.phoneDisplay}
            </a>
            .
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
