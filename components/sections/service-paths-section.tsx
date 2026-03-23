import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agencyDeliverables, diyFeatures } from "@/data/site-content";

export function ServicePathsSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Ways to work"
          title="Choose DIY with Wovo AI or done-for-you with Wovo Media"
          description="Start where you are now and upgrade when you are ready."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <FadeIn>
            <Card className="h-full">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">DIY path</p>
                <CardTitle>Wovo AI for owner-led execution</CardTitle>
                <p className="text-sm text-slate-600">Plans start at $49 per month.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  {diyFeatures.map((feature) => (
                    <li key={feature.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{feature.title}</p>
                      <p className="mt-1 text-slate-600">{feature.description}</p>
                    </li>
                  ))}
                </ul>
                <Button className="mt-5" href="/wovo-ai">
                  Explore Wovo AI
                </Button>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.08}>
            <Card className="h-full">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Done-for-you path</p>
                <CardTitle>Wovo Media for full-service growth</CardTitle>
                <p className="text-sm text-slate-600">Packages range from $600 to $1,000+ per month.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  {agencyDeliverables.map((feature) => (
                    <li key={feature.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{feature.title}</p>
                      <p className="mt-1 text-slate-600">{feature.description}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button href="/services">View packages</Button>
                  <Button href="/pricing" variant="outline">
                    Compare plans
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
