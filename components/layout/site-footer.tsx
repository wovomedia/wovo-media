import Link from "next/link";
import { brand, navLinks } from "@/data/site-content";
import WovoLogo from "@/components/ui/wovo-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <WovoLogo variant="full" size={130} className="brightness-0 invert mb-3" />
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">{brand.tagline} Licensed, insured, drone certified. Based in Tennessee, serving all 50 states.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["🔒 Licensed","🚁 Drone","⏰ 24/7"].map(b => (
              <span key={b} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-slate-500">{b}</span>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-sm">
            <p><a className="text-slate-400 hover:text-white transition" href={`tel:${brand.phone}`}>📞 {brand.phoneDisplay}</a></p>
            <p><a className="text-slate-400 hover:text-white transition" href={`mailto:${brand.email}`}>✉️ {brand.email}</a></p>
            <p><a className="text-slate-400 hover:text-white transition" href={`mailto:${brand.supportEmail}`}>🛟 {brand.supportEmail}</a></p>
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Navigation</p>
          <div className="space-y-2">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="block text-sm text-slate-400 hover:text-white transition">{link.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Wovo Media AI</p>
          <div className="space-y-2">
            {[
              { label: "Try Free — 7 Days", href: "/wovo-ai" },
              { label: "Caption Generator", href: "/wovo-ai" },
              { label: "AI Image Creator", href: "/wovo-ai" },
              { label: "Business Network 🤝", href: "/wovo-ai/network" },
              { label: "Plans & Pricing", href: "/pricing" },
              { label: "Buy Credits", href: "/wovo-ai/buy-credits" },
            ].map(l => (
              <Link key={l.href+l.label} href={l.href} className="block text-sm text-slate-400 hover:text-white transition">{l.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Contact</p>
          <div className="space-y-2 text-sm text-slate-400">
            <p>Based in <span className="text-white">Tennessee</span></p>
            <p>Serving <span className="text-white">all 50 states</span></p>
            <p className="mt-3"><a className="hover:text-white transition" href={`mailto:${brand.email}`}>{brand.email}</a></p>
            <p><a className="hover:text-white transition" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
            <p><a className="hover:text-white transition" href={`tel:${brand.phone}`}>{brand.phoneDisplay}</a></p>
            <div className="mt-4">
              <Link href="/contact" className="inline-flex items-center gap-1.5 rounded-xl bg-[#4CAF50] px-4 py-2 text-xs font-bold text-white hover:bg-[#43A047] transition">📅 Book a Meeting</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} {brand.legalName}. All rights reserved.</p>
          <p className="text-xs text-slate-600">{brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
