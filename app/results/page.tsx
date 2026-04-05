import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/sections/cta-banner";
import { FadeIn } from "@/components/motion/fade-in";
import { PageIntro } from "@/components/sections/page-intro";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { caseStudies, homeStats } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Results | Wovo Media",
  description: "Case studies and outcomes from Wovo Media campaigns.",
};

export default function ResultsPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Results"
        title="Proof from restaurant-focused campaigns"
        description="From viral restaurant clips to offer-driven bookings, Wovo is built around measurable outcomes."
        primaryCta={{ label: "Book a Call", href: "/contact" }}
        secondaryCta={{ label: "See Pricing", href: "/pricing" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Snapshot"
            title="Performance highlights"
            description="A quick look at outcomes before diving into full case study detail."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {homeStats.map((item, index) => (
              <FadeIn key={item.headline} delay={index * 0.05}>
                <Card className="h-full">
                  <CardHeader>
                    <p className="text-3xl font-semibold text-slate-900">{item.value}</p>
                    <CardTitle className="text-base">{item.headline}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">{item.detail}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Case studies"
            title="Detailed campaign stories"
            description="Click into each story for challenge, strategy, and outcome breakdowns."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {caseStudies.map((study, index) => (
              <FadeIn key={study.slug} delay={index * 0.06}>
                <Card className="h-full">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{study.industry}</p>
                    <CardTitle>{study.business}</CardTitle>
                    <p className="text-sm text-slate-600">{study.location}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">{study.monthlyViews}</p>
                    <p className="text-sm text-slate-600">{study.challenge}</p>
                    <Link href={`/case-studies/${study.slug}`} className="inline-flex text-sm font-semibold underline">
                      Read full case study
                    </Link>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        title="Want results like these in your market?"
        description="We can start with a fast seven-day paid test, then scale a plan that matches your budget and goals."
        primary={{ label: "Start with a Call", href: "/contact" }}
        secondary={{ label: "View Services", href: "/services" }}
      />
    </main>
  );
}
