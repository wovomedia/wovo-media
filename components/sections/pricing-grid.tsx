import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/data/site-content";

type PricingGridProps = {
  plans: Plan[];
};

export function PricingGrid({ plans }: PricingGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => (
        <FadeIn key={plan.name} delay={index * 0.05}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-semibold text-slate-900">{plan.price}</p>
              <p className="text-sm text-slate-600">{plan.subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-700">
                {plan.deliverables.map((deliverable) => (
                  <li key={deliverable} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    {deliverable}
                  </li>
                ))}
              </ul>
              <Button className="w-full" href={plan.ctaHref}>
                {plan.ctaLabel}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      ))}
    </div>
  );
}
