import { ContactForm } from "@/components/forms/contact-form";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/data/site-content";

type ContactSectionProps = {
  compact?: boolean;
};

export function ContactSection({ compact = false }: ContactSectionProps) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Contact"
          title={compact ? "Get started with Wovo" : "Tell us your goals and we will send a plan"}
          description="Share your business details and growth goals. We will reply with the best-fit option."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <FadeIn>
            <Card>
              <CardContent className="p-6 sm:p-7">
                <ContactForm />
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.08}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Prefer direct contact?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>
                  Email{" "}
                  <a className="font-semibold text-slate-900 underline" href={`mailto:${brand.email}`}>
                    {brand.email}
                  </a>
                </p>
                <p>
                  Call or text{" "}
                  <a className="font-semibold text-slate-900 underline" href={`tel:${brand.phone}`}>
                    {brand.phoneDisplay}
                  </a>
                </p>
                <p>{brand.reach}. We can travel for on-site filming when needed.</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Best for new clients</p>
                  <p className="mt-1">
                    Start with the $150 seven-day paid test, then move into a $600-$1,000+ monthly package when
                    results are strong.
                  </p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
