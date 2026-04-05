import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeading } from "@/components/sections/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiFeatureCards } from "@/data/site-content";

export function AIFeatureSection() {
  return (
    <section className="bg-[var(--wm-muted)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Inside Wovo Media AI"
          title="Write a caption. Generate the image. Post in 60 seconds."
          description="No design skills needed. Works for restaurants, healthcare, farms, contractors, retailers, government, and every other business type."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <FadeIn>
            <Card className="h-full overflow-hidden">
              <CardHeader>
                <CardTitle>Caption + Image — together in one workflow</CardTitle>
                <p className="text-sm text-slate-600">Tell Wovo what you want to promote. Get a ready-to-post caption AND a matching AI image instantly.</p>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
                  <div className="mb-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-300">
                    ✍️ "Weekend brisket special — $12.99, Friday-Sunday only"
                  </div>
                  <div className="mb-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100 leading-relaxed">
                    🔥 Weekend special alert! Our slow-smoked brisket plate is just $12.99 — only Fri–Sun while supplies last.<br/><br/>
                    Tender, juicy, fall-apart perfection with 2 sides. 🤤 Tag someone who needs this!<br/><br/>
                    #BBQ #WeekendSpecial #ColumbiaTN #SmallBusiness
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="aspect-square rounded-lg bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center text-emerald-400 text-lg">🖼️</div>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[10px] text-emerald-400">3 AI marketing images generated ✓</p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
          <div className="grid gap-4">
            {aiFeatureCards.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <Card className="h-full">
                  <CardHeader><CardTitle className="text-lg">{f.title}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed text-slate-600">{f.description}</p></CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
