import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Terms of Use | Wovo Media",
  description: "Terms of use for Wovo Media LLC and Wovo AI services.",
};

export default function TermsOfUsePage() {
  return (
    <main className="bg-[var(--wm-page)] py-14 sm:py-18">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0e1318] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Terms of Use</h1>
          <p className="mt-3 text-sm text-gray-300">Effective date: March 24, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-gray-300">
            <section>
              <h2 className="text-lg font-semibold text-white">1. Agreement</h2>
              <p>By using Wovo websites, apps, and services (&quot;Services&quot;), you agree to these Terms. If you do not agree, do not use the Services.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">2. Accounts and security</h2>
              <p>You are responsible for account credentials, activity under your account, and maintaining accurate profile information.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">3. User content and consent responsibilities</h2>
              <p>
                By uploading content to Wovo AI, you agree that videos uploaded to or generated on the platform are owned by {brand.legalName}.
                {` `}
                We grant you a revocable, non-exclusive license to use approved outputs for your business, marketing, and income generation.
              </p>
              <p>You represent and warrant that you have all legal rights, licenses, and consents required for any media you upload or generate, including rights to voices, faces, names, trademarks, music, and copyrighted material.</p>
              <p>If you upload or generate content featuring a person&apos;s likeness, voice, or identity, you represent that you have valid consent and any required model release.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">4. Public posting controls</h2>
              <p>Content is only posted publicly when you choose to publish it. You are solely responsible for content you publish and for compliance with platform rules and applicable laws.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">5. Prohibited uses</h2>
              <p>You may not use the Services for unlawful, deceptive, infringing, defamatory, harassing, discriminatory, or harmful content, including impersonation or non-consensual deepfake-style use of a person&apos;s likeness.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">6. Credits, plans, and billing</h2>
              <p>Paid features may require subscriptions or credits. Pricing and plan terms may change. Unless required by law, fees are non-refundable after usage or billing cycle activation.</p>
              <p>If an account is suspended or banned for violations of these Terms, refunds are not provided except where required by applicable law.</p>
              <p>
                If a Wovo AI feature experiences a technical issue, we will work to fix it as soon as possible. For these service issues, we generally do not issue retroactive refunds for the current billing period; however, you may cancel before your next renewal date to avoid future charges.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">7. Service availability</h2>
              <p>We may modify, suspend, or discontinue features at any time. We do not guarantee uninterrupted or error-free operation.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">8. Disclaimer</h2>
              <p>The Services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, to the fullest extent permitted by law.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">9. Limitation of liability</h2>
              <p>To the fullest extent permitted by law, {brand.legalName} and its officers, employees, and affiliates are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, data, goodwill, or business opportunities arising from use of the Services.</p>
              <p>To the fullest extent permitted by law, our total liability for claims related to the Services is limited to amounts paid by you to us for the Services during the 12 months before the claim arose.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">10. Indemnification</h2>
              <p>You agree to defend, indemnify, and hold harmless {brand.legalName} from claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising from your content, your use of the Services, your violation of these Terms, or your violation of rights of another person or entity.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">11. Enforcement and termination</h2>
              <p>Wovo administrators may investigate violations and may suspend, disable feed posting, restrict features, or permanently ban accounts that violate these Terms or create legal, trust, or security risk.</p>
              <p>Administrative enforcement decisions may be made without prior notice where necessary to protect users, rights holders, or platform integrity.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">12. Governing law</h2>
              <p>These Terms are governed by applicable laws in the jurisdiction where {brand.legalName} is organized, subject to mandatory consumer protections that apply in your location.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">13. Contact</h2>
              <p>
                Questions may be sent to{" "}
                <a className="underline hover:text-white" href={`mailto:${brand.email}`}>
                  {brand.email}
                </a>
                .
              </p>
            </section>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-gray-400">
            <p>
              This page is a general legal draft for operations and risk reduction. Have licensed legal counsel review and customize it for final enforceability in your jurisdiction.
            </p>
            <p className="mt-2">
              See also: <Link href="/privacy-policy" className="underline hover:text-white">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
