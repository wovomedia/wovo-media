import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "User Data Deletion",
  description: "How to request deletion of WOVO Media account, workspace, support, upload, and future connected-account data.",
  alternates: { canonical: "/data-deletion" },
  robots: { index: true, follow: true },
};

const steps = [
  ["1. Start the request", "Use the authenticated WOVO team inbox when you can sign in. Otherwise use the public support form and select a data or account request. A direct email to support@wovomedia.com is also available when operationally necessary."],
  ["2. Identify the account safely", "Provide the email address used for WOVO, the business or workspace name, and whether the request covers the whole account or specific uploads, support records, or connected services. Never send a password, payment-card number, access token, or social-media credential."],
  ["3. Verify control", "WOVO may ask you to verify control of the account or business asset before deleting private data. This prevents an unaffiliated person from deleting another client’s workspace."],
  ["4. Receive a case reference", "WOVO records the request in the private team inbox and provides a human-friendly case reference. That reference is used for status follow-up; WOVO does not expose a public lookup that could reveal whether an account exists."],
  ["5. Complete eligible deletion", "After verification, WOVO deletes or de-identifies eligible data and disconnects applicable third-party access. Some billing, security, consent, fraud-prevention, dispute, or legal records may need to be retained for a limited period."],
];

export default function DataDeletionPage() {
  return (
    <main className="py-14 sm:py-20">
      <article className="mx-auto max-w-4xl px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b53a24]">Privacy operations</p>
        <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] sm:text-6xl">User Data Deletion</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f5951]">
          These instructions cover WOVO account, private workspace, support, uploaded-asset, and future connected-account data. They do not require a public address or the owner’s personal contact information.
        </p>
        <div className="mt-10 divide-y divide-[#191714]/15 border-y border-[#191714]/15">
          {steps.map(([title, copy]) => (
            <section key={title} className="py-7">
              <h2 className="text-2xl font-medium tracking-[-0.02em]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5f5951]">{copy}</p>
            </section>
          ))}
        </div>

        <section id="meta" className="mt-8 scroll-mt-24 rounded-[24px] border border-[#191714]/10 bg-[#fffdf8] p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b53a24]">Facebook / Instagram data</p>
          <h2 className="mt-2 text-2xl font-medium">Meta connection deletion</h2>
          <p className="mt-3 text-sm leading-7 text-[#5f5951]">
            WOVO’s official Meta publishing integration is not live. When a reviewed integration is enabled, clients will be able to revoke their own tenant-scoped connection in WOVO and through Meta. A verified deletion request will remove or render unusable WOVO-held connection tokens and eligible connection records. WOVO never asks for a Facebook or Instagram password.
          </p>
        </section>

        <section id="status" className="mt-5 scroll-mt-24 rounded-[24px] bg-[#191714] p-5 text-white sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ff8c70]">Request status</p>
          <h2 className="mt-2 text-2xl font-medium">Follow up with your case reference.</h2>
          <p className="mt-3 text-sm leading-7 text-white/70">Use the authenticated team inbox or the public support form and include only the WOVO case reference. Status details are shared privately after identity verification.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f05a3a] px-5 text-sm font-bold text-[#191714]">Open support request</Link>
            <a href={`mailto:${brand.supportEmail}?subject=WOVO%20data%20deletion%20request`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white">Email {brand.supportEmail}</a>
          </div>
        </section>

        <div className="mt-8 rounded-2xl bg-[#e9e2d6] p-5 text-xs leading-6 text-[#655f56]">
          This operational deletion process is not a promise to delete records that WOVO must retain under applicable law or legitimate security, billing, or dispute requirements. Final jurisdiction-specific retention language requires qualified legal review.
          <p className="mt-2">Related: <Link href="/privacy-policy" className="font-bold underline underline-offset-4">Privacy Policy</Link> · <Link href="/terms-of-use" className="font-bold underline underline-offset-4">Terms of Use</Link></p>
        </div>
      </article>
    </main>
  );
}
