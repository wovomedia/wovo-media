import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/cta-banner";
import { PageIntro } from "@/components/sections/page-intro";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { agencyOfferNote } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Pricing | Wovo Media",
  description: "Transparent pricing for Wovo AI (from $24.99/mo with 7-day free trial) and Wovo Media done-for-you packages from $450/mo.",
};

const aiPlans = [
  {
    name: "Starter",
    price: "$24.99",
    period: "/mo",
    credits: "50 credits / month",
    badge: null,
    features: [
      "7-day free trial included",
      "50 AI credits every month",
      "Caption generator (all platforms)",
      "AI image generation",
      "Content ideas engine",
      "Business network access",
    ],
    cta: "Start Free Trial",
    href: "/wovo-ai",
  },
  {
    name: "Growth",
    price: "$49.99",
    period: "/mo",
    credits: "150 credits / month",
    badge: "Most Popular",
    features: [
      "7-day free trial included",
      "150 AI credits every month",
      "Everything in Starter",
      "Caption + Image in one click",
      "Saved chat history",
      "Reference image uploads",
      "Business network + messaging",
    ],
    cta: "Start Free Trial",
    href: "/wovo-ai",
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    credits: "300 credits / month",
    badge: "Best Value",
    features: [
      "7-day free trial included",
      "300 AI credits every month",
      "Priority AI generation speed",
      "Advanced brand voice presets",
      "Best value per credit",
      "Priority support",
      "Full network features",
    ],
    cta: "Start Free Trial",
    href: "/wovo-ai",
  },
];

const agencyPlans = [
  {
    name: "Essential",
    price: "$450",
    period: "/mo",
    badge: "New",
    desc: "A great entry point for any business",
    features: [
      "Social media strategy setup",
      "2x posts per week (managed)",
      "Monthly performance report",
      "Caption & hashtag writing",
      "Ad setup guidance",
      "24/7 communication",
    ],
  },
  {
    name: "Starter",
    price: "$600",
    period: "/mo",
    badge: null,
    desc: "Consistent local visibility & trust",
    features: [
      "Weekly content production & edits",
      "Platform posting & optimization",
      "Monthly performance recap",
      "Conversion recommendations",
      "24/7 communication",
    ],
  },
  {
    name: "Growth",
    price: "$800",
    period: "/mo",
    badge: "Best Value",
    desc: "More velocity + lead generation",
    features: [
      "Everything in Starter",
      "Paid ad setup & management",
      "Lead capture funnel setup",
      "Campaign A/B testing",
      "Bi-weekly strategy calls",
    ],
  },
  {
    name: "Full Service",
    price: "$1,000+",
    period: "/mo",
    badge: null,
    desc: "Complete media partnership",
    features: [
      "Everything in Growth",
      "On-site filming + drone sessions",
      "Website conversion upgrades",
      "Priority strategy access",
      "Custom campaign planning",
    ],
  },
];

export default function PricingPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Pricing"
        title="Transparent plans for every business"
        description="Wovo AI from $24.99/mo with a 7-day free trial. Done-for-you agency starting at $450/mo. No long contracts."
        primaryCta={{ label: "Book a Free Call", href: "/contact" }}
        secondaryCta={{ label: "Try Wovo Media AI Free", href: "/wovo-ai" }}
      />

      {/* AI Plans */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Wovo AI — DIY plans"
            title="Start free. Create instantly."
            description="All plans include a 7-day free trial. Caption generation AND AI image creation included on every plan."
          />

          {/* Trial banner */}
          <div className="mt-6 mb-8 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="font-semibold text-slate-900">7-Day Free Trial on All Plans</p>
              <p className="text-sm text-slate-600">Pick any plan below — your card won't be charged until after 7 days. Cancel anytime before that and pay nothing.</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {aiPlans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.05}>
                <div className={`relative flex h-full flex-col rounded-2xl border p-6 ${plan.badge === "Most Popular" ? "border-[var(--wm-accent)] bg-white shadow-[0_16px_40px_rgba(0,233,145,0.15)]" : "border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,36,0.06)]"}`}>
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold ${plan.badge === "Most Popular" ? "bg-[var(--wm-accent)] text-slate-900" : "bg-slate-900 text-white"}`}>
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--wm-accent)]">{plan.credits}</div>
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <div className="my-3 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-500">{plan.period}</span>
                  </div>
                  <p className="mb-1 text-xs font-semibold text-emerald-600">✓ 7-day free trial</p>
                  <ul className="mb-6 mt-3 flex-1 space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 text-emerald-500 flex-shrink-0">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button href={plan.href} className="w-full">{plan.cta}</Button>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Credit add-ons */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="font-semibold text-slate-900 mb-3">Need more credits? Add-on packs available anytime:</p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Small Pack", credits: "+5 credits", price: "$1.50" },
                { label: "Medium Pack", credits: "+20 credits", price: "$5.00" },
                { label: "Large Pack", credits: "+50 credits", price: "$10.00" },
              ].map(p => (
                <div key={p.label} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-900">{p.credits}</span>
                  <span className="text-slate-400 mx-1">·</span>
                  <span className="text-emerald-600 font-semibold">{p.price}</span>
                  <span className="text-slate-400 text-xs ml-1">one-time</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agency Plans */}
      <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Wovo Media — Done for you"
            title="Let our team handle everything"
            description="From $450/mo for managed social media to $1,000+/mo for full-service production with drone filming. Licensed, insured, 24/7 available."
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {agencyPlans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.05}>
                <div className={`relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-[0_4px_20px_rgba(15,23,36,0.06)] ${plan.badge === "Best Value" ? "border-[var(--wm-accent)]" : "border-slate-200"}`}>
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${plan.badge === "Best Value" ? "bg-[var(--wm-accent)] text-slate-900" : "bg-slate-800 text-white"}`}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <div className="my-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-500 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{plan.desc}</p>
                  <ul className="flex-1 space-y-1.5 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="mt-0.5 text-emerald-500 flex-shrink-0">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button href="/contact" variant="outline" className="w-full text-sm">Book a Call</Button>
                </div>
              </FadeIn>
            ))}
          </div>
          <Card className="mt-6">
            <CardContent className="p-5 text-sm text-slate-700">{agencyOfferNote}</CardContent>
          </Card>
        </div>
      </section>

      <CtaBanner
        title="Not sure which plan is right for you?"
        description="Book a free 1-hour strategy call. We'll look at your business, your goals, and recommend the best path — AI, done-for-you, or both."
        primary={{ label: "Book Free Strategy Call", href: "/contact" }}
        secondary={{ label: "Try Wovo Media AI — 7 Days Free", href: "/wovo-ai" }}
      />
    </main>
  );
}
