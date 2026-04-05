import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { caseStudies } from "@/data/site-content";

export function CaseStudyPreviewSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Case studies" title="Real campaigns. Measurable results." description="From viral restaurant content to healthcare trust-building — every type of business can grow with the right strategy." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.slice(0, 3).map((study, i) => (
            <FadeIn key={study.slug} delay={i * 0.06}>
              <Card className="h-full transition hover:-translate-y-0.5">
                <CardHeader>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{study.industry}</p>
                  <CardTitle>{study.business}</CardTitle>
                  <p className="text-sm text-slate-500">{study.location}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--wm-accent)]">{study.monthlyViews}</p>
                  <p className="text-sm text-slate-600">{study.strategy}</p>
                  <Link href={`/case-studies/${study.slug}`} className="inline-flex text-sm font-semibold text-slate-900 underline">Read case study →</Link>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
