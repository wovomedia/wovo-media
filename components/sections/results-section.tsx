import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homeStats, testimonials } from "@/data/site-content";

export function ResultsSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Real Results"
          title="25M+ views. Real businesses. Real growth."
          description="From viral restaurant content to county government campaigns — Wovo delivers measurable outcomes across every industry."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {homeStats.map((item, i) => (
            <FadeIn key={item.headline} delay={i * 0.05}>
              <Card className="h-full">
                <CardHeader>
                  <p className="text-3xl font-semibold text-[var(--wm-accent)]">{item.value}</p>
                  <CardTitle className="text-base">{item.headline}</CardTitle>
                </CardHeader>
                <CardContent><CardDescription>{item.detail}</CardDescription></CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <div className="mt-10">
          <SectionHeading eyebrow="What clients say" title="Trusted by real Tennessee businesses" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((item, i) => (
              <FadeIn key={item.author} delay={i * 0.05}>
                <Card className="h-full border-slate-200">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm leading-relaxed text-slate-700">&ldquo;{item.quote}&rdquo;</p>
                    <p className="text-sm font-semibold text-slate-900">{item.author}, <span className="font-normal text-slate-500">{item.business}</span></p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
