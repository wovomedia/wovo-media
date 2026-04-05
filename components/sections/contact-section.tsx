import { ContactForm } from "@/components/forms/contact-form";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/data/site-content";

export function ContactSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Contact"
          title={compact ? "Get started with Wovo" : "Tell us your goals and we'll build a plan"}
          description="Share your business details and growth goals. We reply fast — usually within the hour."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <FadeIn><Card><CardContent className="p-6 sm:p-7"><ContactForm /></CardContent></Card></FadeIn>
          <FadeIn delay={0.08}>
            <Card className="h-full">
              <CardHeader><CardTitle>Prefer direct contact?</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>📧 <a className="font-semibold underline" href={`mailto:${brand.email}`}>{brand.email}</a> — Payton directly</p>
                <p>🛟 <a className="font-semibold underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> — support team</p>
                <p>📞 <a className="font-semibold underline" href={`tel:${brand.phone}`}>{brand.phoneDisplay}</a> — call or text</p>
                <p>{brand.reach}. On-site filming available nationwide.</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">🗓️ Book a free 1-hour strategy call</p>
                  <p className="mt-1 text-slate-600">Available Mon–Sat, 12 PM–8 PM CST. Google Meet or phone.</p>
                  <a href="/contact#book" className="mt-2 inline-block font-semibold text-[var(--wm-accent)] underline">Schedule now →</a>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">🚀 Not sure where to start?</p>
                  <p className="mt-1 text-slate-600">Try the $150 7-day paid content test — see results before you commit to a full package.</p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
