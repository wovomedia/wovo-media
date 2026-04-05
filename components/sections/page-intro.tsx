import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

type Props = { eyebrow: string; title: string; description: string; primaryCta: { label: string; href: string }; secondaryCta?: { label: string; href: string } };

export function PageIntro({ eyebrow, title, description, primaryCta, secondaryCta }: Props) {
  return (
    <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,rgba(0,233,145,0.13),transparent_48%),var(--wm-page)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button href={primaryCta.href} size="lg">{primaryCta.label}</Button>
            {secondaryCta && <Button href={secondaryCta.href} size="lg" variant="outline">{secondaryCta.label}</Button>}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
