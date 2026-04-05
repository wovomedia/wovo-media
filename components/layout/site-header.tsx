"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { brand, navLinks } from "@/data/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import WovoLogo from "@/components/ui/wovo-logo";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Wovo Media home" className="flex items-center shrink-0">
          <WovoLogo variant="full" href="" />
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                link.label === "Network"
                  ? pathname === link.href ? "bg-emerald-100 text-emerald-700" : "text-emerald-600 hover:bg-emerald-50"
                  : pathname === link.href ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900")}>
              {link.label === "Network" ? "🤝 " : ""}{link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button href={`tel:${brand.phone}`} variant="ghost" size="sm">📞 Call/Text</Button>
          <Button href="/wovo-ai" size="sm" variant="outline">Try AI Free</Button>
          <Button href="/contact" size="sm">Book a Call ↗</Button>
        </div>
        <button type="button" aria-expanded={open} aria-label="Toggle navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
          onClick={() => setOpen(p => !p)}>
          <span className="text-xs font-bold">{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                className={cn("rounded-lg px-3 py-2 text-sm font-medium",
                  pathname === link.href ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50")}>
                {link.label === "Network" ? "🤝 " : ""}{link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button href={`tel:${brand.phone}`} variant="outline" size="sm" onClick={() => setOpen(false)}>Call/Text</Button>
            <Button href="/contact" size="sm" onClick={() => setOpen(false)}>Book a Call</Button>
          </div>
        </div>
      )}
    </header>
  );
}
