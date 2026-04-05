import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Privacy Policy | Wovo Media",
  description: "Privacy policy for Wovo Media LLC and Wovo AI services.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[var(--wm-page)] py-14 sm:py-18">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0e1318] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-gray-300">Effective date: March 24, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-gray-300">
            <section>
              <h2 className="text-lg font-semibold text-white">1. Who this applies to</h2>
              <p>
                This Privacy Policy explains how {brand.legalName} (&quot;Wovo,&quot; &quot;we,&quot; &quot;our,&quot; or
                &quot;us&quot;) collects, uses, and discloses information when you use our website, Wovo AI tools,
                subscriptions, and related services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">2. Information we collect</h2>
              <p>We may collect account details (such as name, email, username), billing-related details, usage analytics, and content you upload or generate inside Wovo AI.</p>
              <p>When you upload photos, video, audio, or likeness data, you are responsible for making sure you have all required permissions and consents.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">3. How we use information</h2>
              <p>We use information to provide and improve the service, process payments, secure accounts, support customers, detect abuse, and operate features such as private libraries and public feed posting when enabled by the user.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">4. Public vs private content</h2>
              <p>Content is private by default unless you choose to publish it publicly. If you choose to publish, your content may appear in feed surfaces and profile pages visible to other users.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">5. Video ownership and commercial usage</h2>
              <p>
                By using Wovo AI, you acknowledge and agree that videos uploaded to or generated on this platform are owned by {brand.legalName}. We allow account holders to use those videos for lawful business operations, advertising, and income generation subject to these policies and our Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">6. Data sharing</h2>
              <p>We may share data with service providers that help us run authentication, storage, infrastructure, billing, and support operations. We may also disclose information when required by law, legal process, or to protect rights and safety.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">7. Retention and deletion</h2>
              <p>We retain information for as long as needed to provide services, comply with legal obligations, resolve disputes, and enforce agreements. If you delete your account, we will process deletion requests according to applicable law and operational backup limits.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">8. Security</h2>
              <p>We use reasonable administrative, technical, and organizational safeguards, but no system can guarantee absolute security.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">9. Your choices</h2>
              <p>You can edit profile details, update account settings, and request account deletion from your account area. You may also contact us to request access or correction where required by law.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">10. Children</h2>
              <p>Our services are not intended for children under 13, and we do not knowingly collect personal information from children under 13.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">11. Contact</h2>
              <p>
                Questions about this policy can be sent to{" "}
                <a className="underline hover:text-white" href={`mailto:${brand.email}`}>
                  {brand.email}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">12. Service issues and billing support</h2>
              <p>
                If a Wovo AI feature is not working correctly, contact our support team and we will work to resolve the issue as soon as possible.
              </p>
              <p>
                For platform-performance issues, we do not provide retroactive refunds for the current billing period. You may cancel before the next renewal date to prevent future charges while we address the issue.
              </p>
            </section>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-gray-400">
            <p>
              This page is a general policy draft and should be reviewed by qualified legal counsel for final legal compliance in your operating jurisdictions.
            </p>
            <p className="mt-2">
              See also: <Link href="/terms-of-use" className="underline hover:text-white">Terms of Use</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
