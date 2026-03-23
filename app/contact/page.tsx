import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/cta-banner";
import { ContactSection } from "@/components/sections/contact-section";
import { PageIntro } from "@/components/sections/page-intro";
import { brand } from "@/data/site-content";

export const metadata: Metadata = {
  title: "Contact | Wovo Media",
  description: "Contact Wovo Media for AI subscriptions, done-for-you services, and growth planning.",
};

export default function ContactPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Contact"
        title="Talk with the Wovo team"
        description="Tell us your goals and timeline. We will recommend whether DIY, done-for-you, or a hybrid path fits best."
        primaryCta={{ label: "Call or Text", href: `tel:${brand.phone}` }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
      />
      <ContactSection />
      <CtaBanner
        title="Need immediate help?"
        description={`Call or text ${brand.phoneDisplay} and we will get back to you as quickly as possible.`}
        primary={{ label: "Call Now", href: `tel:${brand.phone}` }}
        secondary={{ label: "Send Email", href: `mailto:${brand.email}` }}
      />
    </main>
  );
}
