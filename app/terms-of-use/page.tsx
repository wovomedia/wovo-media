import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Account, content, billing, acceptable-use, and service terms for WOVO Media.",
  alternates: { canonical: "/terms-of-use" },
};

const sections = [
  ["1. Agreement", "By using WOVO websites, the client workspace, or related services, you agree to these Terms. If you do not agree, do not use the services."],
  ["2. Accounts and eligibility", "You are responsible for accurate account information, safeguarding credentials, and activity under your account. Paid workspace access requires a verified account and active subscription unless WOVO has authorized a staff or administrative exemption."],
  ["3. Your content and permissions", "You retain whatever ownership rights you hold in materials you supply. You grant WOVO a limited license to host, process, and use those materials as necessary to provide requested services. You represent that you have the rights and consents needed for uploaded media, names, trademarks, music, property information, likenesses, and voices."],
  ["4. Generated drafts and publishing", "AI-assisted outputs may be incomplete or inaccurate and require human review. WOVO does not promise automatic external publishing unless a specific compliant integration is separately enabled. You remain responsible for approving factual claims and final published content."],
  ["5. Prohibited use", "You may not use the services for unlawful, deceptive, infringing, harassing, discriminatory, harmful, impersonation, non-consensual likeness or voice use, credential abuse, or attempts to access another customer's data."],
  ["6. Subscription and separate services", "The core workspace renews at the monthly, three-month, six-month, or yearly cadence selected and shown in Stripe Checkout. One-time creation credits may be purchased without a recurring subscription. On-site production, drone work, website projects, custom editing, travel, and additional staff time are not included unless separately scoped and purchased."],
  ["7. Service changes and availability", "Features may change as the service evolves. WOVO does not guarantee uninterrupted or error-free operation and will not represent an unconfigured third-party integration as active."],
  ["8. Enforcement and termination", "WOVO may investigate suspected misuse and restrict or terminate access where reasonably necessary to protect users, rights holders, service integrity, or legal compliance."],
  ["9. Governing terms", "Applicable law and mandatory consumer protections may vary. Any separate signed order or service agreement can include additional project-specific terms."],
];

export default function TermsOfUsePage() {
  return (
    <main className="py-14 sm:py-20">
      <article className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Terms & responsibilities</p>
        <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] sm:text-6xl">Terms of Use</h1>
        <p className="mt-4 text-sm text-[#756e64]">Last updated July 30, 2026</p>
        <div className="mt-10 divide-y divide-[#191714]/15 border-y border-[#191714]/15">
          {sections.map(([title, copy]) => (
            <section key={title} className="py-7">
              <h2 className="text-2xl font-medium tracking-[-0.02em]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5f5951]">{copy}</p>
            </section>
          ))}
          <section className="py-7">
            <h2 className="text-2xl font-medium tracking-[-0.02em]">10. Contact</h2>
            <p className="mt-3 text-sm leading-7 text-[#5f5951]">Use the authenticated client support workspace or contact <a href={`mailto:${brand.supportEmail}`} className="font-bold text-[#d94326] underline underline-offset-4">{brand.supportEmail}</a>.</p>
          </section>
        </div>
        <div className="mt-8 rounded-2xl bg-[#e9e2d6] p-5 text-xs leading-6 text-[#655f56]">
          These terms are operational launch wording and are not a substitute for qualified legal advice. Final limitation-of-liability, governing-law, and jurisdiction-specific provisions require owner and counsel review.
          <p className="mt-2">See also: <Link href="/privacy-policy" className="font-bold underline underline-offset-4">Privacy Policy</Link></p>
        </div>
      </article>
    </main>
  );
}
