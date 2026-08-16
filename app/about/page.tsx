import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About the WOVO Marketing Workspace",
  description: "WOVO combines a self-directed weekly marketing workspace with optional, separately scoped human production services.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-[#191714]/10 py-16 sm:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">About WOVO</p>
          <h1 className="mt-6 max-w-5xl text-[clamp(3rem,7vw,6.2rem)] font-medium leading-[.92] tracking-[-0.055em]">Built around the work, not the hype.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655f56]">WOVO is a self-directed workspace for independent businesses that need a clearer way to plan, review, and move weekly marketing forward.</p>
        </div>
      </section>
      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Operating principles</p>
          <div className="divide-y divide-[#191714]/15 border-y border-[#191714]/15">
            {[
              ["Context matters", "The useful starting point is the business, audience, offers, voice, and source material—not a generic prompt."],
              ["People stay in control", "Generated work enters a visible review queue. WOVO does not imply that external publishing happens without approval."],
              ["Service boundaries stay clear", "The software subscription and human production services are priced separately."],
            ].map(([title, copy]) => (
              <article key={title} className="py-8">
                <h2 className="text-3xl font-medium tracking-[-0.03em]">{title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#655f56]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#f05a3a] py-16">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-4xl font-medium tracking-[-0.035em]">Serving businesses worldwide.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#191714]/70">Public support is handled through support@wovomedia.com and the authenticated client workspace.</p>
          </div>
          <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#191714] px-7 text-sm font-bold text-white">Contact WOVO</Link>
        </div>
      </section>
    </main>
  );
}
