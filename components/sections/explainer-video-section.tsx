"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";

const workflowSteps = [
  "Record or upload restaurant media",
  "Wovo AI generates captions, images, and video scripts",
  "Post to social channels",
  "Customers respond with bookings and messages",
];

export function ExplainerVideoSection() {
  const [videoFailed, setVideoFailed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % workflowSteps.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Explainer"
          title="A 60-second look at how Wovo AI works"
          description="Watch the AI workflow in action, from campaign prompt to social-ready output."
        />

        <FadeIn className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-white/12 bg-[var(--wm-surface)] p-3 shadow-[0_20px_55px_rgba(0,0,0,0.35)] sm:p-4">
            {!videoFailed ? (
              <video
                className="h-[220px] w-full rounded-2xl object-cover sm:h-[360px] lg:h-[460px]"
                controls
                preload="metadata"
                poster="/images/explainer-placeholder.svg"
                onError={() => setVideoFailed(true)}
              >
                <source src="/videos/wovo-explainer.mp4" type="video/mp4" />
              </video>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(0,233,145,0.2),transparent_42%),linear-gradient(165deg,#090f14,#111922)] p-5">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                    <Image
                      src="/images/explainer-placeholder.svg"
                      alt="Wovo AI workflow visual"
                      width={1280}
                      height={720}
                      className="h-auto w-full rounded-xl"
                    />
                  </div>
                  <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.11em] text-emerald-200">Demo workflow reel</p>
                    <p className="mt-2 text-sm text-gray-200">This sequence represents the exact order Wovo AI follows for restaurant campaigns.</p>
                    <ul className="mt-4 grid gap-2 text-sm text-gray-200">
                      {workflowSteps.map((step, index) => (
                        <li
                          key={step}
                          className={`rounded-xl border px-3 py-2 transition ${
                            activeStep === index
                              ? "border-[#00E991]/50 bg-[#00E991]/15 text-white"
                              : "border-white/12 bg-white/5"
                          }`}
                        >
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
