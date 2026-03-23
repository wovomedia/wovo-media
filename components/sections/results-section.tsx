import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homeStats, testimonials } from "@/data/site-content";

export function ResultsSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Proof"
          title="Real restaurant outcomes, not vanity metrics"
          description="We keep reporting simple: reach, bookings, calls, and repeat demand."
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
                  <CardDescription>{item.detail}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <div className="mt-10">
          <SectionHeading
            eyebrow="Testimonials"
            title="What clients say"
            description="Client voices are a major trust signal. We keep this section visible across the funnel."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <FadeIn key={`${item.author}-${item.business}`} delay={index * 0.05}>
                <Card className="h-full border-slate-300 bg-white/95">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm leading-relaxed text-slate-700">&ldquo;{item.quote}&rdquo;</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.author}, <span className="font-normal text-slate-600">{item.business}</span>
                    </p>
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
