"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Button } from "@/components/ui/button";
import { agencyPlans, aiPlans, type Plan } from "@/data/site-content";

type CalculatorMode = "ai" | "agency";

export function PricingCalculatorSection() {
  const [mode, setMode] = useState<CalculatorMode>("ai");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const plans = useMemo<Plan[]>(() => (mode === "ai" ? aiPlans : agencyPlans), [mode]);
  const activePlan = plans[selectedIndex] ?? plans[0];
  const heroImage = activePlan.previewImage ?? "/images/hero-ai.svg";
  const heroAlt = activePlan.previewAlt ?? `${activePlan.name} preview`;
  const previewPoints = activePlan.previewPoints ?? [];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing calculator"
          title="Interactive plan comparison"
          description="Toggle between DIY and done-for-you, then preview each plan with campaign-style visuals."
        />

        <FadeIn className="mt-8 rounded-3xl border border-white/15 bg-black/20 p-5 shadow-[0_20px_50px_rgba(15,23,36,0.1)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/15 bg-white/[0.04] p-2">
            <button
              type="button"
              onClick={() => {
                setMode("ai");
                setSelectedIndex(0);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === "ai" ? "bg-[var(--wm-accent)] text-[#07281b]" : "text-slate-300"
              }`}
            >
              Wovo AI (DIY)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("agency");
                setSelectedIndex(0);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === "agency" ? "bg-[var(--wm-accent)] text-[#07281b]" : "text-slate-300"
              }`}
            >
              Wovo Media (Done-For-You)
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-300">Available plans</p>
              <div className="mt-3 grid gap-2">
                {plans.map((plan, index) => (
                  <button
                    key={plan.name}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      index === selectedIndex
                        ? "border-[var(--wm-accent)] bg-[linear-gradient(140deg,rgba(0,233,145,0.18),rgba(0,0,0,0.32))] text-white"
                        : "border-white/15 bg-black/30 text-slate-200 hover:border-white/30"
                    }`}
                  >
                    <div className="grid grid-cols-[84px_1fr] gap-3">
                      <div className="relative h-16 overflow-hidden rounded-lg border border-white/15">
                        <Image
                          src={plan.previewImage ?? "/images/hero-ai.svg"}
                          alt={plan.previewAlt ?? `${plan.name} preview`}
                          fill
                          sizes="84px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{plan.name}</p>
                        <p className={`text-xs ${index === selectedIndex ? "text-slate-200" : "text-slate-400"}`}>
                          {plan.price}
                        </p>
                        {plan.previewBadge ? (
                          <p className="mt-1 inline-flex rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-300">
                            {plan.previewBadge}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/25 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-300">Plan preview</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                <div className="relative h-44 w-full sm:h-52">
                  <Image src={heroImage} alt={heroAlt} fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020806] via-[#020806]/35 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-2xl font-semibold tracking-tight text-white">{activePlan.name}</h3>
                    <p className="mt-1 text-sm text-slate-200">{activePlan.subtitle}</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--wm-accent)]">{activePlan.price}</p>
                  </div>
                </div>
              </div>

              {previewPoints.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {previewPoints.map((point) => (
                    <span key={point} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-slate-200">
                      {point}
                    </span>
                  ))}
                </div>
              ) : null}

              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {activePlan.deliverables.map((deliverable) => (
                  <li key={deliverable} className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100">
                    {deliverable}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button className="w-full sm:w-auto" href={activePlan.ctaHref}>
                  {activePlan.ctaLabel}
                </Button>
                <Button className="w-full sm:w-auto" href="/pricing" variant="outline">
                  Compare Full Pricing
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
