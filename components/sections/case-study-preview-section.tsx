import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { caseStudies } from "@/data/site-content";

export function CaseStudyPreviewSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Case studies"
          title="Restaurant wins, plus support for other U.S. small businesses"
          description="Our strongest volume comes from food and hospitality, and we also support selected service industries."
        />
        {/* TODO: Insert approved client logos/photos on each case study card once assets are available. */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((study, index) => (
            <FadeIn key={study.slug} delay={index * 0.06}>
              <Card className="h-full transition hover:-translate-y-0.5">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{study.industry}</p>
                  <CardTitle>{study.business}</CardTitle>
                  <p className="text-sm text-slate-600">{study.location}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm font-semibold text-slate-900">{study.monthlyViews}</p>
                  <p className="text-sm text-slate-600">{study.strategy}</p>
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="inline-flex text-sm font-semibold text-slate-900 underline"
                  >
                    Open case study
                  </Link>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
