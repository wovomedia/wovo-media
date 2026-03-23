import Link from "next/link";
import { brand, navLinks } from "@/data/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold text-white">{brand.name}</p>
          <p className="mt-3 max-w-sm text-sm text-slate-300">{brand.tagline}</p>
          <p className="mt-3 text-sm text-slate-300">{brand.reach}</p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {navLinks.map((link) => (
              <Link key={link.href} className="text-slate-300 hover:text-white" href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Contact</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Email:{" "}
              <a className="hover:text-white" href={`mailto:${brand.email}`}>
                {brand.email}
              </a>
            </p>
            <p>
              Call/Text:{" "}
              <a className="hover:text-white" href={`tel:${brand.phone}`}>
                {brand.phoneDisplay}
              </a>
            </p>
            <p>Based in {brand.baseLocation}, serving nationwide.</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Copyright {new Date().getFullYear()} {brand.legalName}.
          </p>
          <p>{brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
