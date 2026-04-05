import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { brand, founder } from "@/data/site-content";
import { Button } from "@/components/ui/button";

export function FounderSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <div className="flex h-80 w-full items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-[0_16px_44px_rgba(15,23,36,0.12)]">
            <div className="text-center text-white">
              <div className="mb-3 text-6xl font-black text-[var(--wm-accent)]">W</div>
              <p className="text-xl font-bold">Payton Cody</p>
              <p className="text-sm text-slate-400">Founder & CEO, Wovo Media</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.08} className="space-y-6">
          <SectionHeading eyebrow="Founder-led" title={`${founder.name}, ${founder.title}`} description={founder.bio} />
          <div className="space-y-1 text-sm text-slate-600">
            <p>📧 Personal: <a className="font-semibold text-slate-900 underline" href={`mailto:${brand.email}`}>{brand.email}</a></p>
            <p>🛟 Support: <a className="font-semibold text-slate-900 underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
            <p>📞 Call/Text: <a className="font-semibold text-slate-900 underline" href={`tel:${brand.phone}`}>{brand.phoneDisplay}</a></p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/about">Our Story</Button>
            <Button href="/contact" variant="outline">Book a Call</Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
