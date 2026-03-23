import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { whyWovo } from "@/data/site-content";

export function WhyWovoSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why Wovo"
          title="Built for practical growth, not marketing noise"
          description="A founder-led team, transparent pricing paths, and execution that works for busy owners."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {whyWovo.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.05}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
