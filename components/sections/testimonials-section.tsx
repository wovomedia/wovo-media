import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { caseStudies, testimonials } from "@/data/site-content";

const featuredStudies = caseStudies.slice(0, 3);

export function TestimonialsSection() {
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Social proof"
          title="Testimonials and case studies owners can verify"
          description="Client feedback and campaign data are visible early in the journey to reduce friction before contact."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={`${testimonial.author}-${testimonial.business}`} delay={index * 0.06} y={16}>
              <Card className="h-full border-slate-200/95 bg-white/95">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-center gap-3">
                    <Image
                      src={testimonial.photo}
                      alt={`${testimonial.business} client portrait`}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                      loading="lazy"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{testimonial.author}</p>
                      <p className="text-xs text-slate-600">{testimonial.role} - {testimonial.business}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">&ldquo;{testimonial.quote}&rdquo;</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <div className="mt-10">
          <SectionHeading
            eyebrow="Case studies"
            title="Featured restaurant campaigns"
            description="Performance cards link directly to full breakdowns."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredStudies.map((study, index) => (
              <FadeIn key={study.slug} delay={index * 0.05} y={16}>
                <Card className="h-full border-slate-200/95 bg-white transition hover:-translate-y-0.5">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{study.industry}</p>
                    <CardTitle>{study.business}</CardTitle>
                    <p className="text-sm text-slate-600">{study.location}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 text-xs text-slate-700">
                      {study.metrics.slice(0, 3).map((metric) => (
                        <p key={metric} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">
                          {metric}
                        </p>
                      ))}
                    </div>
                    <Link
                      href={`/case-studies/${study.slug}`}
                      className="inline-flex text-sm font-semibold text-slate-900 underline underline-offset-2"
                    >
                      View full case study
                    </Link>
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
