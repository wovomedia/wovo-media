import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { timelineSteps } from "@/data/site-content";

const previewImages = [
  "/images/workflow/caption-generator.svg",
  "/images/workflow/ad-studio.svg",
  "/images/workflow/ai-spokesperson.svg",
];

export function HowItWorksTimelineSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From first brief to repeatable content in three steps"
          description="A clear rollout path for busy owners who want predictable output and measurable growth."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {timelineSteps.map((step, index) => (
            <FadeIn key={step.step} delay={index * 0.06} y={18}>
              <article className="relative h-full overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
                <div className="overflow-hidden rounded-xl border border-white/12">
                  <Image
                    src={previewImages[index] ?? previewImages[0]}
                    alt={`${step.title} preview`}
                    width={1000}
                    height={620}
                    className="h-36 w-full object-cover"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full border border-emerald-300/45 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">
                    Step {step.step}
                  </span>
                  <span className="h-2 w-12 rounded-full bg-[var(--wm-accent)]" aria-hidden />
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.description}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

