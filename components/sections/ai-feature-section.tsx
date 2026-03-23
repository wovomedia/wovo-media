import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiFeatureCards } from "@/data/site-content";

export function AIFeatureSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Inside Wovo AI"
          title="Create faster with tools built for small teams"
          description="Generate scripts, captions, ad visuals, and spokesperson content from one workflow."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <FadeIn>
            <Card className="h-full overflow-hidden">
              <CardHeader>
                <CardTitle>How the workflow feels in practice</CardTitle>
                <p className="text-sm text-slate-600">
                  Upload clips, generate campaign assets, and publish with a repeatable calendar.
                </p>
              </CardHeader>
              <CardContent>
                {/* TODO: Replace this product mockup with real Wovo AI screenshots or a short looping demo video. */}
                <Image
                  src="/images/ai-workflow.svg"
                  alt="Placeholder visual showing an AI content workflow dashboard"
                  width={900}
                  height={700}
                  className="w-full rounded-2xl border border-slate-200 object-cover"
                />
              </CardContent>
            </Card>
          </FadeIn>

          <div className="grid gap-4">
            {aiFeatureCards.map((feature, index) => (
              <FadeIn key={feature.title} delay={index * 0.05}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
