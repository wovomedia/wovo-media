"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brand, payments } from "@/data/site-content";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
};

type Goal = "captions" | "ads" | "video" | "growth";
type Workstyle = "diy" | "mixed" | "done";
type Budget = "under200" | "upTo600" | "upTo1000" | "over1000";

type Recommendation = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

const steps = ["Goal", "Workstyle", "Budget", "Plan"] as const;

function getRecommendation(workstyle: Workstyle, budget: Budget): Recommendation {
  if (workstyle === "done" && (budget === "upTo1000" || budget === "over1000")) {
    return {
      title: "Wovo Media Premium ($1,000/mo)",
      subtitle: "Best fit for owners who want full team execution with premium output speed.",
      ctaLabel: "Choose Premium Team",
      ctaHref: payments.agencyPremiumCheckout,
      secondaryLabel: "See Growth ($600)",
      secondaryHref: payments.agencyGrowthCheckout,
    };
  }

  if (workstyle === "done" || budget === "upTo600" || workstyle === "mixed") {
    return {
      title: "Wovo Media Growth ($600/mo)",
      subtitle: "Best fit if you want your team to handle production and campaign execution.",
      ctaLabel: "Choose Growth Team",
      ctaHref: payments.agencyGrowthCheckout,
      secondaryLabel: "See Premium ($1,000)",
      secondaryHref: payments.agencyPremiumCheckout,
    };
  }

  if (budget === "under200") {
    return {
      title: "Wovo AI Starter ($49/mo)",
      subtitle: "Best fit for DIY owners starting fast with lower cost.",
      ctaLabel: "Start Starter Plan",
      ctaHref: payments.aiStarterCheckout,
      secondaryLabel: "See Pro ($229)",
      secondaryHref: payments.aiProCheckout,
    };
  }

  return {
    title: "Wovo AI Pro ($229/mo)",
    subtitle: "Best fit for owners creating at higher volume without full done-for-you support.",
    ctaLabel: "Start Pro Plan",
    ctaHref: payments.aiProCheckout,
    secondaryLabel: "Keep it lean ($49)",
    secondaryHref: payments.aiStarterCheckout,
  };
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [goal, setGoal] = useState<Goal>("captions");
  const [workstyle, setWorkstyle] = useState<Workstyle>("diy");
  const [budget, setBudget] = useState<Budget>("under200");

  const recommendation = useMemo(() => getRecommendation(workstyle, budget), [budget, workstyle]);
  const isLastStep = activeStep === steps.length - 1;

  const resetAndClose = () => {
    setActiveStep(0);
    setGoal("captions");
    setWorkstyle("diy");
    setBudget("under200");
    onClose();
  };

  const canContinue = () => {
    if (activeStep === 0) return Boolean(goal);
    if (activeStep === 1) return Boolean(workstyle);
    if (activeStep === 2) return Boolean(budget);
    return true;
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetAndClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#101615] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wovo-onboarding-heading"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Image src={brand.logoIcon} alt="Wovo AI robot icon" width={38} height={38} className="wm-logo-glow h-9 w-9 rounded-lg" />
                <p className="rounded-full border border-[#00E991]/40 bg-[#00E991]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#00E991]">
                  Wovo AI Guide {activeStep + 1}/{steps.length}
                </p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
                aria-label="Close onboarding modal"
              >
                x
              </button>
            </div>

            <div className="mt-6 flex gap-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded-full ${index <= activeStep ? "bg-[#00E991]" : "bg-white/15"}`}
                  aria-hidden
                />
              ))}
            </div>

            <h2 id="wovo-onboarding-heading" className="mt-6 text-[clamp(1.35rem,2.5vw,2rem)] font-semibold tracking-tight">
              {activeStep === 0 ? "What do you want Wovo AI to help with first?" : null}
              {activeStep === 1 ? "Do you want DIY tools or your team to handle execution?" : null}
              {activeStep === 2 ? "What monthly budget range feels right today?" : null}
              {activeStep === 3 ? "Here is your recommended plan" : null}
            </h2>

            <div className="mt-5 space-y-3">
              {activeStep === 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setGoal("captions")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${goal === "captions" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Captions and ideas</button>
                  <button type="button" onClick={() => setGoal("ads")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${goal === "ads" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Ads and visuals</button>
                  <button type="button" onClick={() => setGoal("video")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${goal === "video" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Video content</button>
                  <button type="button" onClick={() => setGoal("growth")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${goal === "growth" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Full business growth</button>
                </div>
              ) : null}

              {activeStep === 1 ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <button type="button" onClick={() => setWorkstyle("diy")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${workstyle === "diy" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>DIY with Wovo AI</button>
                  <button type="button" onClick={() => setWorkstyle("mixed")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${workstyle === "mixed" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Mixed support</button>
                  <button type="button" onClick={() => setWorkstyle("done")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${workstyle === "done" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Have my team do it</button>
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setBudget("under200")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${budget === "under200" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Under $200/mo</button>
                  <button type="button" onClick={() => setBudget("upTo600")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${budget === "upTo600" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Around $600/mo</button>
                  <button type="button" onClick={() => setBudget("upTo1000")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${budget === "upTo1000" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>Around $1,000/mo</button>
                  <button type="button" onClick={() => setBudget("over1000")} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${budget === "over1000" ? "border-[#00E991]/60 bg-[#00E991]/15 text-[#00E991]" : "border-white/15 bg-black/25 text-gray-200 hover:border-white/35"}`}>More than $1,000/mo</button>
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="rounded-2xl border border-[#00E991]/35 bg-[#00E991]/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00E991]">Recommended</p>
                  <h3 className="mt-2 text-2xl font-semibold">{recommendation.title}</h3>
                  <p className="mt-2 text-sm text-gray-200">{recommendation.subtitle}</p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button href={recommendation.ctaHref} size="lg">
                      {recommendation.ctaLabel}
                    </Button>
                    {recommendation.secondaryHref && recommendation.secondaryLabel ? (
                      <Button href={recommendation.secondaryHref} size="lg" variant="outline">
                        {recommendation.secondaryLabel}
                      </Button>
                    ) : null}
                    <Button href="/contact" size="lg" variant="ghost">
                      Talk to Wovo Team
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300">
              Goal: {goal} | Workstyle: {workstyle} | Budget: {budget}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
                disabled={activeStep === 0}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-semibold text-gray-100 transition hover:border-white/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              {isLastStep ? (
                <Button href="/wovo-ai" size="lg" onClick={resetAndClose}>
                  Open Wovo AI Dashboard
                </Button>
              ) : (
                <Button
                  size="lg"
                  type="button"
                  onClick={() => setActiveStep((current) => Math.min(current + 1, steps.length - 1))}
                  disabled={!canContinue()}
                >
                  Continue
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
