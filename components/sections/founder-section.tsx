import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { brand, founder } from "@/data/site-content";
import { Button } from "@/components/ui/button";

export function FounderSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <FadeIn>
          {/* TODO: Replace this placeholder with a professional founder portrait. */}
          <Image
            src="/images/founder-placeholder.svg"
            alt="Placeholder portrait card for Payton Cody"
            width={740}
            height={820}
            className="w-full rounded-3xl border border-slate-200 bg-white object-cover shadow-[0_16px_44px_rgba(15,23,36,0.08)]"
          />
        </FadeIn>

        <FadeIn delay={0.08} className="space-y-6">
          <SectionHeading
            eyebrow="Founder-led"
            title={`${founder.name}, ${founder.title}`}
            description={founder.bio}
          />
          <p className="text-sm leading-relaxed text-slate-600">
            Prefer direct communication? Email{" "}
            <a className="font-semibold text-slate-900 underline" href={`mailto:${brand.email}`}>
              {brand.email}
            </a>{" "}
            or call/text{" "}
            <a className="font-semibold text-slate-900 underline" href={`tel:${brand.phone}`}>
              {brand.phoneDisplay}
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/about">Read our story</Button>
            <Button href="/contact" variant="outline">
              Start a conversation
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
