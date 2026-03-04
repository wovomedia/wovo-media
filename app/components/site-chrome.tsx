import Link from "next/link";

const BRAND = {
  name: "Wovo Media",
  legal: "Wovo Media LLC",
  url: "https://wovomedia.com",
  phone: "931-458-3255",
};

const navLinks = [
  { href: "/wovo-ai", label: "Wovo AI" },
  { href: "/#services", label: "Services" },
  { href: "/#results", label: "Results" },
  { href: "/#process", label: "Process" },
  { href: "/#growth", label: "Proven Growth" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-extrabold tracking-tight text-white">
          {BRAND.name}
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-white/80 lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} className="transition hover:text-white" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/wovo-ai"
            className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 sm:text-sm"
          >
            Login / Signup
          </Link>
          <a
            href={`sms:${BRAND.phone}`}
            className="hidden rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 md:inline-flex"
          >
            Text
          </a>
          <Link
            href="/wovo-ai"
            aria-label="Profile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 text-xs font-extrabold tracking-wide text-emerald-100 transition hover:bg-emerald-400/20"
          >
            WM
          </Link>
          <Link
            href="/#contact"
            className="rounded-xl bg-emerald-400 px-3 py-2 text-sm font-extrabold text-black transition hover:bg-emerald-300 sm:px-4"
          >
            Book a Call
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} {BRAND.legal}. All rights reserved.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/#contact" className="transition hover:text-white">
            Contact
          </Link>
          <a href={`tel:${BRAND.phone}`} className="transition hover:text-white">
            Call {BRAND.phone}
          </a>
          <a href={BRAND.url} target="_blank" rel="noreferrer" className="transition hover:text-white">
            {BRAND.url.replace("https://", "")}
          </a>
        </div>
      </div>
    </footer>
  );
}
