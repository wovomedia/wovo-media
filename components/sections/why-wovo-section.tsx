import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { whyWovo } from "@/data/site-content";

export function WhyWovoSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Why Wovo" title="Built for every business, not just restaurants" description="We work with any industry — healthcare, government, farms, contractors, retail, and more. Licensed, insured, drone certified, 24/7." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {whyWovo.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.05}>
              <Card className="h-full">
                <CardHeader><CardTitle className="text-lg">{item.title}</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{item.description}</p></CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
