import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { currentClients, pastClients } from "@/data/site-content";

export function ClientShowcaseSection() {
  const icons: Record<string, string> = {
    "Restaurant": "🍽️",
    "Healthcare": "🏥",
    "Government": "🏛️",
    "Farm & Venue": "🌾",
    "Specialty Retail": "💡",
    "Home Services": "🔧",
    "Contracting": "🔨",
  };

  return (
    <section className="py-14 sm:py-18 bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Our Clients"
          title="Businesses we're proud to serve"
          description="From Tennessee restaurants to county government — Wovo Media works with every type of business."
          className="text-white [&_p]:text-slate-400 [&_.eyebrow]:text-emerald-400"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentClients.map((client, i) => (
            <FadeIn key={client.name} delay={i * 0.05}>
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/8">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                  {icons[client.type] ?? "🏢"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white leading-snug">{client.name}</p>
                  <p className="text-sm text-slate-400">{client.type} · {client.location}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    Active
                  </span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {pastClients.map((client, i) => (
            <FadeIn key={client.name} delay={i * 0.05}>
              <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">
                  {icons[client.type] ?? "🏢"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-400">{client.name}</p>
                  <p className="text-xs text-slate-600">{client.type}</p>
                </div>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-600">Past</span>
              </div>
            </FadeIn>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            Ready to join them?{" "}
            <a href="/contact" className="font-semibold text-emerald-400 underline underline-offset-2">
              Book a free strategy call →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
