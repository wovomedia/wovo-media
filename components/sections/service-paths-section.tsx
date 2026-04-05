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
          eyebrow="Ways to work with Wovo"
          title="DIY with Wovo AI or done-for-you with Wovo Media"
          description="Start where you are now. Upgrade when you're ready. Every type of business welcome."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <FadeIn>
            <Card className="h-full">
              <CardHeader>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">DIY path · From $24.99/mo</p>
                <CardTitle>Wovo AI — Build your own content</CardTitle>
                <p className="text-sm text-slate-500">7-day free trial on all plans. No design experience needed.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  {diyFeatures.map((f) => (
                    <li key={f.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{f.title}</p>
                      <p className="mt-1 text-slate-600">{f.description}</p>
                    </li>
                  ))}
                </ul>
                <Button className="mt-5" href="/wovo-ai">Try Wovo Media AI — 7 Days Free →</Button>
              </CardContent>
            </Card>
          </FadeIn>
          <FadeIn delay={0.08}>
            <Card className="h-full">
              <CardHeader>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Done-for-you · From $450/mo</p>
                <CardTitle>Wovo Media — We handle everything</CardTitle>
                <p className="text-sm text-slate-500">Licensed, insured, drone certified. 24/7 support. Any industry.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  {agencyDeliverables.map((f) => (
                    <li key={f.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{f.title}</p>
                      <p className="mt-1 text-slate-600">{f.description}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button href="/services">View Services</Button>
                  <Button href="/pricing" variant="outline">See Pricing</Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
