import type { Metadata } from "next";
import Image from "next/image";
import { CtaBanner } from "@/components/sections/cta-banner";
import { FadeIn } from "@/components/motion/fade-in";
import { PageIntro } from "@/components/sections/page-intro";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brand, founder, whyWovo } from "@/data/site-content";

export const metadata: Metadata = {
  title: "About | Wovo Media",
  description: "Learn about Wovo Media, our mission, and founder Payton Cody.",
};

export default function AboutPage() {
  return (
    <main>
      <PageIntro
        eyebrow="About Wovo"
        title="A founder-led media company built for local growth"
        description="Wovo Media combines practical AI tooling with high-output creative services for restaurants."
        primaryCta={{ label: "Contact the Team", href: "/contact" }}
        secondaryCta={{ label: "See Results", href: "/results" }}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <FadeIn>
            {/* TODO: Replace with team and founder photography from current brand shoot. */}
            <Image
              src="/images/team-placeholder.svg"
              alt="Placeholder image for Wovo Media team"
              width={820}
              height={840}
              className="w-full rounded-3xl border border-slate-200 bg-white object-cover shadow-[0_16px_44px_rgba(15,23,36,0.08)]"
            />
          </FadeIn>
          <FadeIn delay={0.08} className="space-y-4">
            <SectionHeading eyebrow="Founder" title={`${founder.name}, ${founder.title}`} description={founder.bio} />
            <p className="text-sm text-slate-600">
              Direct contact:{" "}
              <a className="font-semibold text-slate-900 underline" href={`mailto:${brand.email}`}>
                {brand.email}
              </a>
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Values"
            title="How we partner with clients"
            description="Clear communication, consistent execution, and outcomes tied to real business goals."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {whyWovo.map((item, index) => (
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

      <CtaBanner
        title="Ready to build a growth system that your team can sustain?"
        description="We can start with AI, done-for-you services, or a hybrid plan based on your current bandwidth."
        primary={{ label: "Talk to Wovo", href: "/contact" }}
        secondary={{ label: "See Pricing", href: "/pricing" }}
      />
    </main>
  );
}
