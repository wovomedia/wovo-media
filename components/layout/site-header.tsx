"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks } from "@/data/site-content";
import { getActiveSession } from "@/lib/supabase/session-client";

const privatePrefixes = ["/portal", "/admin", "/login", "/signup", "/auth", "/forgot-password", "/reset-password"];

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2" aria-label="WOVO Media">
      <span className="text-[1.35rem] font-black leading-none tracking-[-0.075em] text-[#191714]">WOVO</span>
      <span className="rounded-full border border-[#191714]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#5e584f]">
        Media
      </span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    void getActiveSession().then((session) => {
      if (active) setSignedIn(Boolean(session));
    });
    return () => { active = false; };
  }, [pathname]);
  if (privatePrefixes.some((path) => pathname.startsWith(path))) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#191714]/10 bg-[#f3efe6]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="WOVO Media home" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`relative text-[13px] font-semibold tracking-[0.01em] transition after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:rounded-full after:bg-[#f05a3a] after:transition-all ${
                pathname === link.href
                  ? "text-[#191714] after:w-full"
                  : "text-[#5e584f] after:w-0 hover:text-[#191714] hover:after:w-full"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href={signedIn ? "/portal" : "/login?next=/portal"} className="text-[13px] font-semibold text-[#5e584f] transition hover:text-[#191714]">
            {signedIn ? "Workspace active" : "Sign in"}
          </Link>
          <Link
            href={signedIn ? "/portal" : "/signup?next=/portal"}
            className="inline-flex min-h-11 items-center rounded-full bg-[#191714] px-5 text-[13px] font-bold text-white transition hover:bg-[#f05a3a]"
          >
            {signedIn ? "Open workspace" : "Start free"}
          </Link>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label="Toggle navigation"
          className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border border-[#191714]/20 px-3 text-xs font-bold text-[#191714] lg:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-navigation" className="border-t border-[#191714]/10 bg-[#f3efe6] px-5 py-5 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`inline-flex min-h-12 items-center border-b border-[#191714]/10 text-base font-semibold ${
                  pathname === link.href ? "text-[#d94326]" : "text-[#3e3a34]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href={signedIn ? "/portal" : "/login?next=/portal"} onClick={() => setOpen(false)} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#191714]/25 text-sm font-bold">
              {signedIn ? "Workspace active" : "Sign in"}
            </Link>
            <Link href={signedIn ? "/portal" : "/signup?next=/portal"} onClick={() => setOpen(false)} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#191714] px-4 text-center text-sm font-bold text-white">
              {signedIn ? "Open workspace" : "Start free"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
