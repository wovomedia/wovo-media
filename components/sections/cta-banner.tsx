import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

type Props = { title: string; description: string; primary: { label: string; href: string }; secondary?: { label: string; href: string } };

export function CtaBanner({ title, description, primary, secondary }: Props) {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,36,0.08)] sm:p-10">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-3 max-w-2xl text-slate-600">{description}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href={primary.href} size="lg">{primary.label}</Button>
            {secondary && <Button href={secondary.href} size="lg" variant="outline">{secondary.label}</Button>}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
