import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { processSteps } from "@/data/site-content";

export function ProcessSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Process" title="Discover, create, then scale" description="The same performance loop powers both our DIY AI tools and done-for-you agency work." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {processSteps.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.05}>
              <Card className="h-full">
                <CardHeader>
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{i + 1}</div>
                  <CardTitle className="pt-2">{step.title}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-600">{step.description}</p></CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
