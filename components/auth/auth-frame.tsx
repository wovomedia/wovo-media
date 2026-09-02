import Link from "next/link";
import type { ReactNode } from "react";
import WovoLogo from "@/components/ui/wovo-logo";

type AuthFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

// Three things that are actually true of a new WOVO account. The panel this
// replaced showed a mocked-up week of projects that did not exist, which read
// as a promise the product had not made yet.
const ASSURANCES = [
  "10 free credits, no card required",
  "Your work stays private to your workspace",
  "Download anything you make",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-[#ff8c70]" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function AuthFrame({ eyebrow, title, description, children }: AuthFrameProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b0b0c] text-[#f7f4ee]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(240,90,58,.16),transparent_70%)]"
      />

      <header className="relative flex min-h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="WOVO home" className="inline-flex items-center">
          <WovoLogo variant="full" size={112} className="brightness-0 invert" />
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-semibold text-white/55 transition hover:text-white"
        >
          Back to site
        </Link>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-[28px] border border-white/12 bg-[#151516] p-6 shadow-[0_32px_100px_rgba(0,0,0,.5)] sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff7659]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[2.1rem] font-medium leading-[1.05] tracking-[-.045em]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/45">{description}</p>
            <div className="mt-7">{children}</div>
          </div>

          <ul className="mt-6 grid gap-2.5 px-1">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-xs text-white/45">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="relative flex flex-wrap items-center justify-center gap-x-5 px-5 pb-6 text-[11px] text-white/32">
        <Link href="/terms-of-use" className="inline-flex min-h-9 items-center transition hover:text-white/70">Terms</Link>
        <Link href="/privacy-policy" className="inline-flex min-h-9 items-center transition hover:text-white/70">Privacy</Link>
        <Link href="/cancellation-refund-policy" className="inline-flex min-h-9 items-center transition hover:text-white/70">Cancellation</Link>
        <Link href="/contact" className="inline-flex min-h-9 items-center transition hover:text-white/70">Support</Link>
      </footer>
    </main>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-5" aria-hidden>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[#151516] px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          or use email
        </span>
      </div>
    </div>
  );
}

export const authInputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-white/[.04] px-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-[#f05a3a]/60 focus:bg-white/[.06] focus:ring-3 focus:ring-[#f05a3a]/15";

export const authPrimaryButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-black text-[#140b08] transition hover:bg-[#ff7659] focus:outline-none focus:ring-3 focus:ring-[#f05a3a]/30 disabled:cursor-not-allowed disabled:opacity-55";

export const authSecondaryButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/[.03] px-5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[.06] focus:outline-none focus:ring-3 focus:ring-[#f05a3a]/15 disabled:cursor-not-allowed disabled:opacity-55";
