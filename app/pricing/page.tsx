import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/cta-banner";
import { PageIntro } from "@/components/sections/page-intro";
import { PricingGrid } from "@/components/sections/pricing-grid";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { agencyOfferNote, agencyPlans, aiPlans } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Pricing | Wovo Media",
  description: "Transparent pricing for Wovo AI subscriptions and Wovo Media done-for-you packages.",
};

export default function PricingPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Pricing"
        title="Transparent plans for DIY and done-for-you growth"
        description="Start with Wovo AI at $49/$249 per month, or hire Wovo Media from $600 to $1,000+ per month."
        primaryCta={{ label: "Book a Call", href: "/contact" }}
        secondaryCta={{ label: "View Results", href: "/results" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Wovo AI plans"
            title="DIY subscriptions"
            description="For teams that want to create content faster in-house."
          />
          <div className="mt-8 md:max-w-4xl">
            <PricingGrid plans={aiPlans} />
          </div>
        </div>
      </section>

      <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Wovo Media packages"
            title="Done-for-you services"
            description="For owners who want production, distribution, and optimization handled by the team."
          />
          <div className="mt-8">
            <PricingGrid plans={agencyPlans} />
          </div>
          <Card className="mt-6">
            <CardContent className="p-5 text-sm text-slate-700">{agencyOfferNote}</CardContent>
          </Card>
        </div>
      </section>

      <CtaBanner
        title="Need a blended plan?"
        description="Many clients start with Wovo AI and add done-for-you execution as they scale."
        primary={{ label: "Build My Plan", href: "/contact" }}
      />
    </main>
  );
}
