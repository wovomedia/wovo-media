"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const privatePrefixes = ["/portal", "/admin", "/login", "/signup", "/auth", "/forgot-password", "/reset-password"];

export function SiteFooter() {
  const pathname = usePathname();
  if (privatePrefixes.some((path) => pathname.startsWith(path))) return null;

  return (
    <footer className="bg-[#191714] text-[#f3efe6]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-[-0.075em]">WOVO</span>
            <span className="rounded-full border border-white/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/65">Media</span>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/60">
            A focused weekly marketing workspace for independent businesses. Serving businesses worldwide.
          </p>
          <Link href="/contact" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#ff8c70] hover:text-white">
            Contact WOVO
          </Link>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Workspace</p>
          <div className="mt-4 flex flex-col">
            <Link href="/product" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Product</Link>
            <Link href="/workflow" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Workflow</Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Pricing</Link>
            <Link href="/cartoon-episodes" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Cartoon Episodes</Link>
            <Link href="/services" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Human services</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Account & support</p>
          <div className="mt-4 flex flex-col">
            <Link href="/portal" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Client workspace</Link>
            <Link href="/login?next=/portal" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Sign in</Link>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Account recovery</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center text-sm text-white/65 hover:text-white">Help & contact</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-5 text-xs text-white/65 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} WOVO Media LLC. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5">
            <Link href="/terms-of-use" className="inline-flex min-h-11 items-center hover:text-white">Terms</Link>
            <Link href="/privacy-policy" className="inline-flex min-h-11 items-center hover:text-white">Privacy</Link>
            <Link href="/data-deletion" className="inline-flex min-h-11 items-center hover:text-white">Data deletion</Link>
            <Link href="/cancellation-refund-policy" className="inline-flex min-h-11 items-center hover:text-white">Cancellation & refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
