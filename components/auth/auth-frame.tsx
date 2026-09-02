import Link from "next/link";
import type { ReactNode } from "react";
import WovoLogo from "@/components/ui/wovo-logo";

type AuthFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const previewItems = [
  ["Launch-week carousel", "Instagram", "Review"],
  ["Founder story", "Short video", "Ready"],
  ["Weekend offer", "Facebook", "Draft"],
];

export function AuthFrame({ eyebrow, title, description, children }: AuthFrameProps) {
  return <main className="min-h-screen bg-[#eee8dd] text-[#191714] lg:grid lg:grid-cols-[minmax(360px,.82fr)_minmax(540px,1.18fr)]">
    <aside className="relative hidden min-h-screen overflow-hidden bg-[#191714] px-10 py-9 text-white lg:flex lg:flex-col">
      <WovoLogo variant="full" size={128} className="relative z-10 brightness-0 invert" />
      <div className="my-auto max-w-[520px] py-12">
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#ff8c70]">Private WOVO workspace</p>
        <h2 className="mt-5 text-[3.35rem] font-medium leading-[.94] tracking-[-.055em]">A clear place to make the next thing.</h2>
        <div className="mt-9 overflow-hidden rounded-[26px] border border-white/12 bg-white/[.055] shadow-[0_26px_70px_rgba(0,0,0,.28)]">
          <div className="border-b border-white/10 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/40">Ask Adam</p>
            <div className="mt-3 rounded-2xl bg-[#fffdf8] p-4 text-[#191714]">
              <p className="text-sm font-medium">What should WOVO create next?</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Post", "Video", "Cartoon", "Website"].map((item, index) => <span key={item} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${index === 1 ? "bg-[#f05a3a] text-[#191714]" : "bg-[#191714]/[.06] text-[#655f56]"}`}>{item}</span>)}
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/40">This week</p><span className="text-[10px] text-white/35">3 projects</span></div>
            <div className="mt-3 space-y-2">
              {previewItems.map(([name, channel, status]) => <div key={name} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3"><div><p className="text-xs font-semibold">{name}</p><p className="mt-1 text-[10px] text-white/38">{channel}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${status === "Review" ? "bg-[#f05a3a] text-[#191714]" : "bg-white/10 text-white/60"}`}>{status}</span></div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-8 border-t border-white/15 pt-5 pr-5">
        <p className="text-xs leading-5 text-white/45">Email verification and tenant-scoped access protect each business workspace.</p>
        <div className="text-right"><p className="text-xl font-medium">10 free credits</p><p className="text-[10px] text-white/40">No card required</p></div>
      </div>
      <div aria-hidden className="absolute bottom-0 right-0 h-40 w-2 bg-[#f05a3a]" />
    </aside>

    <section className="flex min-h-screen flex-col bg-[#fffdf8] px-5 py-5 sm:px-9 sm:py-7 lg:px-14 lg:py-9">
      <header className="flex items-center justify-between gap-5 border-b border-[#191714]/10 pb-5 lg:justify-end">
        <WovoLogo variant="full" size={118} className="lg:hidden" />
        <Link href="/" className="inline-flex min-h-11 items-center text-xs font-bold text-[#655f56] hover:text-[#191714]">Back to site</Link>
      </header>
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10 sm:py-14">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#d94326]">{eyebrow}</p>
        <h1 className="mt-3 max-w-md text-[2.7rem] font-medium leading-[1] tracking-[-.05em] sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#6d665d]">{description}</p>
        <div className="mt-7">{children}</div>
      </div>
      <footer className="flex flex-wrap items-center gap-x-5 border-t border-[#191714]/10 pt-4 text-[11px] text-[#81796f]">
        <Link href="/terms-of-use" className="inline-flex min-h-10 items-center hover:text-[#191714]">Terms</Link>
        <Link href="/privacy-policy" className="inline-flex min-h-10 items-center hover:text-[#191714]">Privacy</Link>
        <Link href="/cancellation-refund-policy" className="inline-flex min-h-10 items-center hover:text-[#191714]">Cancellation</Link>
        <Link href="/contact" className="inline-flex min-h-10 items-center hover:text-[#191714]">Support</Link>
      </footer>
    </section>
  </main>;
}

export function AuthDivider() {
  return <div className="relative my-5" aria-hidden><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#191714]/12" /></div><div className="relative flex justify-center"><span className="bg-[#fffdf8] px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#948b80]">or use email</span></div></div>;
}

export const authInputClass = "mt-2 min-h-12 w-full rounded-lg border border-[#191714]/18 bg-white px-4 text-base text-[#191714] outline-none transition placeholder:text-[#9a9287] focus:border-[#f05a3a] focus:ring-3 focus:ring-[#f05a3a]/12";
export const authPrimaryButtonClass = "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#191714] px-5 text-sm font-bold text-white transition hover:bg-[#d94326] focus:outline-none focus:ring-3 focus:ring-[#f05a3a]/25 disabled:cursor-not-allowed disabled:opacity-55";
export const authSecondaryButtonClass = "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#191714]/18 bg-white px-5 text-sm font-bold text-[#191714] transition hover:border-[#191714]/35 hover:bg-[#f6f1e8] focus:outline-none focus:ring-3 focus:ring-[#f05a3a]/15 disabled:cursor-not-allowed disabled:opacity-55";
