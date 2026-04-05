import { cn } from "@/lib/utils";

type Props = { eyebrow?: string; title: string; description?: string; className?: string; centered?: boolean };

export function SectionHeading({ eyebrow, title, description, className, centered = false }: Props) {
  return (
    <div className={cn("max-w-3xl space-y-3", centered && "mx-auto text-center", className)}>
      {eyebrow && <p className="eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {description && <p className="text-base leading-relaxed text-slate-600">{description}</p>}
    </div>
  );
}
