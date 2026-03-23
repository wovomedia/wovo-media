import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PageIntro } from "@/components/sections/page-intro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { caseStudies } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Case Studies | Wovo Media",
  description: "Explore Wovo Media campaign case studies.",
};

export default function CaseStudiesPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Case studies"
        title="Campaigns that turned attention into revenue"
        description="Detailed breakdowns of how we plan, produce, and optimize content and conversion systems."
        primaryCta={{ label: "Book a Call", href: "/contact" }}
        secondaryCta={{ label: "See Pricing", href: "/pricing" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((study, index) => (
            <FadeIn key={study.slug} delay={index * 0.05}>
              <Card className="h-full">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{study.industry}</p>
                  <CardTitle>{study.business}</CardTitle>
                  <p className="text-sm text-slate-600">{study.location}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">{study.monthlyViews}</p>
                  <p className="text-sm text-slate-600">{study.strategy}</p>
                  <Link href={`/case-studies/${study.slug}`} className="inline-flex text-sm font-semibold underline">
                    Read case study
                  </Link>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>
    </main>
  );
}
