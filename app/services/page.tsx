import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/cta-banner";
import { FadeIn } from "@/components/motion/fade-in";
import { PageIntro } from "@/components/sections/page-intro";
import { PricingGrid } from "@/components/sections/pricing-grid";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agencyDeliverables, agencyOfferNote, agencyPlans } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Services | Wovo Media",
  description: "Done-for-you restaurant and small business marketing services from Wovo Media.",
};

export default function ServicesPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Done-for-you services"
        title="Full-service content, ads, and conversion support"
        description="Wovo Media handles the production, distribution, and optimization so your team can stay focused on operations."
        primaryCta={{ label: "Book a Call", href: "/contact" }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="What we handle"
            title="Execution built for local business growth"
            description="Use us as your external media team, from filming to lead capture."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {agencyDeliverables.map((item, index) => (
              <FadeIn key={item.title} delay={index * 0.05}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">{item.description}</p>
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
            eyebrow="Packages"
            title="Transparent agency pricing"
            description="Choose a level that matches your current growth stage."
          />
          <div className="mt-8">
            <PricingGrid plans={agencyPlans} />
          </div>
          <p className="mt-6 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
            {agencyOfferNote}
          </p>
        </div>
      </section>

      <CtaBanner
        title="Need custom scope across multiple locations?"
        description="Book a strategy call and we will map a rollout plan that keeps creative and reporting centralized."
        primary={{ label: "Book a Strategy Call", href: "/contact" }}
        secondary={{ label: "See Results", href: "/results" }}
      />
    </main>
  );
}
