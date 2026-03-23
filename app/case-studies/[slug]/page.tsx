import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/cta-banner";
import { PageIntro } from "@/components/sections/page-intro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brand, caseStudies } from "@/data/site-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = caseStudies.find((item) => item.slug === slug);

  if (!study) {
    return {
      title: "Case Study Not Found | Wovo Media",
    };
  }

  return {
    title: `${study.business} Case Study | Wovo Media`,
    description: `${study.business} (${study.location}) campaign story from Wovo Media.`,
  };
}

export default async function CaseStudyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const study = caseStudies.find((item) => item.slug === slug);

  if (!study) {
    notFound();
  }

  return (
    <main>
      <PageIntro
        eyebrow={`${study.industry} case study`}
        title={study.business}
        description={`${study.location} | ${study.monthlyViews}`}
        primaryCta={{ label: "Book a Call", href: "/contact" }}
        secondaryCta={{ label: "Back to Results", href: "/results" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Challenge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-relaxed text-slate-700">{study.challenge}</p>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Strategy</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{study.strategy}</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Outcomes</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {study.outcomes.map((outcome) => (
                    <li key={outcome} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                &ldquo;{study.quote}&rdquo;
              </p>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Client links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {study.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  {link.label}
                </a>
              ))}
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                Need a similar campaign? Contact{" "}
                <a className="font-semibold underline" href={`mailto:${brand.email}`}>
                  {brand.email}
                </a>
                .
              </div>
              <Link href="/case-studies" className="inline-flex text-sm font-semibold underline">
                View all case studies
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <CtaBanner
        title="Want to build a plan like this?"
        description="Start with the seven-day paid test or choose a full monthly package."
        primary={{ label: "Start Now", href: "/contact" }}
      />
    </main>
  );
}
