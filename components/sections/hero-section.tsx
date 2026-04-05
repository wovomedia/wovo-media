import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import WovoLogo from "@/components/ui/wovo-logo";
import { Button } from "@/components/ui/button";
import { brand } from "@/data/site-content";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(0,233,145,0.15),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.10),transparent_38%),var(--wm-page)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <FadeIn className="space-y-6">
          {/* Credential badges */}
          <div className="flex flex-wrap gap-2">
            {["🔒 Licensed & Insured", "🚁 Drone Certified", "⏰ 24/7 Support", "✈️ Nationwide"].map(tag => (
              <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{tag}</span>
            ))}
          </div>

          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Content · AI · Growth · For Every Business
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl leading-[1.05]">
            25 Million Views.<br/>
            <span className="text-[var(--wm-accent)]">Real Results.</span><br/>
            Any Business.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-slate-600">
            Wovo Media is a licensed media company serving businesses across all 50 states — restaurants, healthcare, farms, government, contractors, and more. We do video production, drone filming, social media management, and AI tools.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/contact" size="lg">Book a Free Strategy Call ↗</Button>
            <Button href="/wovo-ai" size="lg" variant="outline">Try Wovo Media AI — 7 Days Free</Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-5">
            {[
              { val: "25M+", label: "Facebook Views" },
              { val: "6+",   label: "Active Clients" },
              { val: "24/7", label: "Always Available" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-slate-900">{s.val}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,36,0.10)]">
            {/* Wovo AI preview card */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-black text-emerald-400">Wovo Media AI</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">Beta</span>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-300 mb-2">
                ✍️ "Write a caption + image for our brisket plate special..."
              </div>
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100 mb-2">
                🔥 Weekend alert — slow-smoked brisket $12.99, Fri–Sun only! Come hungry. 🤤 #BBQ #ColumbiaTN
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {["🖼️","🖼️","🖼️"].map((e,i) => (
                  <div key={i} className="aspect-square rounded-lg bg-white/10 flex items-center justify-center text-lg text-emerald-400">{e}</div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-emerald-400 text-center">Caption + 3 AI images generated ✓</p>
            </div>

            {/* Client highlights */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Campbell Station", stat: "4M+/mo views", icon: "🍽️" },
                { name: "Boot Stompin' BBQ", stat: "150K+/mo views", icon: "🍖" },
                { name: "Renshaw Farms", stat: "Drone + Event", icon: "🌾" },
                { name: "Mayor Sheila Butt", stat: "Gov. Content", icon: "🏛️" },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-lg">{c.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{c.name}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">{c.stat}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-900">🎁 Try Wovo Media AI Free for 7 Days</p>
              <p className="text-[10px] text-slate-600 mt-0.5">No charge until trial ends · Cancel anytime</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
