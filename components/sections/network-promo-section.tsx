import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";

const features = [
  { icon: "🤝", title: "Find Collab Partners",   desc: "Browse the directory of Wovo businesses and reach out to partner on content." },
  { icon: "✨", title: "AI Collab Post Generator", desc: "Let Wovo AI write a joint social post for both businesses — ready to publish." },
  { icon: "💬", title: "Direct Messaging",         desc: "Message other businesses privately to plan campaigns, cross-promos, and more." },
  { icon: "📣", title: "Shared Network Feed",      desc: "See what other businesses are posting and repurpose ideas for your own content." },
];

export function NetworkPromoSection() {
  return (
    <section className="py-16 sm:py-20 bg-slate-950 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 relative">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[500px] w-[700px] rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-400 mb-3">New Feature</p>
            <h2 className="font-semibold text-3xl sm:text-4xl text-white tracking-tight mb-3">
              The Business Network — <span className="text-emerald-400">Exclusive to Wovo AI</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-base leading-relaxed">
              Connect with other local businesses, collaborate on AI-generated posts, share audiences, and grow together. Available to all Wovo AI subscribers.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 h-full transition hover:border-emerald-400/30">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/wovo-ai/network" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-300 shadow-[0_12px_30px_rgba(0,233,145,0.25)]">
              🤝 Explore the Network
            </Link>
            <Link href="/wovo-ai" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
              Start Wovo Media AI Free →
            </Link>
          </div>
          <p className="text-center text-xs text-slate-600 mt-3">Included with all Wovo Media AI plans · 7-day free trial</p>
        </FadeIn>
      </div>
    </section>
  );
}
