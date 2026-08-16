import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How WOVO Media handles account, workspace, billing, support, and uploaded-asset data.",
  alternates: { canonical: "/privacy-policy" },
};

const sections = [
  ["1. Scope", "This policy describes how WOVO Media LLC collects, uses, and shares information when you use the website, private client workspace, subscriptions, and related services."],
  ["2. Information collected", "We may collect account details, business and brand information, support messages, service requests, usage and security records, and content you choose to upload. Stripe handles payment-card details; WOVO receives billing identifiers and status needed to operate subscriptions."],
  ["3. Uploaded assets and permissions", "Private workspace uploads may include photos, video, audio, documents, and information about people depicted. You must have the rights and permissions needed to supply those materials. WOVO uses them to operate the requested workspace and services."],
  ["4. How information is used", "Information may be used to authenticate accounts, provide and secure the workspace, generate requested drafts, process billing status, coordinate support and services, prevent abuse, and improve operations."],
  ["5. Private and public data", "Client workspace data and uploads are private by default. WOVO does not make a private asset public merely because it was uploaded. Any future public-profile or connected-account feature will require separate controls and approval."],
  ["6. Service providers", "We may use providers for hosting, authentication, storage, payments, email, analytics, and support operations. We may also disclose information when legally required or reasonably necessary to protect users, the service, or legal rights."],
  ["7. Retention and deletion", "Information is retained as needed to provide services, maintain security and billing records, resolve disputes, and meet legal obligations. You may request account or data access, correction, or deletion, subject to applicable law and necessary record-retention limits."],
  ["8. Security", "WOVO uses administrative, technical, and organizational safeguards appropriate to the service, but no online system can guarantee absolute security."],
  ["9. Children", "The services are not directed to children under 13, and WOVO does not knowingly collect personal information from children under 13."],
];

export default function PrivacyPolicyPage() {
  return (
    <main className="py-14 sm:py-20">
      <article className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d94326]">Legal & privacy</p>
        <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-[#756e64]">Last updated July 30, 2026</p>
        <div className="mt-10 divide-y divide-[#191714]/15 border-y border-[#191714]/15">
          {sections.map(([title, copy]) => (
            <section key={title} className="py-7">
              <h2 className="text-2xl font-medium tracking-[-0.02em]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5f5951]">{copy}</p>
            </section>
          ))}
          <section className="py-7">
            <h2 className="text-2xl font-medium tracking-[-0.02em]">10. Contact and data requests</h2>
            <p className="mt-3 text-sm leading-7 text-[#5f5951]">Use the authenticated client support workspace where available, or contact <a href={`mailto:${brand.supportEmail}`} className="font-bold text-[#d94326] underline underline-offset-4">{brand.supportEmail}</a>. Do not send passwords, payment-card data, or other highly sensitive information by email.</p>
          </section>
        </div>
        <div className="mt-8 rounded-2xl bg-[#e9e2d6] p-5 text-xs leading-6 text-[#655f56]">
          This policy is operational launch wording and is not a substitute for advice from qualified legal counsel. Business-specific jurisdiction, retention, and statutory notices still require owner and counsel review.
          <p className="mt-2">See also: <Link href="/terms-of-use" className="font-bold underline underline-offset-4">Terms of Use</Link></p>
        </div>
      </article>
    </main>
  );
}
