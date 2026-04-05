import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/data/site-content";

export function PricingGrid({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, i) => (
        <FadeIn key={plan.name} delay={i * 0.05}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-semibold text-slate-900">{plan.price}</p>
              <p className="text-sm text-slate-600">{plan.subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-700">
                {plan.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span> {d}
                  </li>
                ))}
              </ul>
              <Button className="w-full" href={plan.ctaHref}>{plan.ctaLabel}</Button>
            </CardContent>
          </Card>
        </FadeIn>
      ))}
    </div>
  );
}
