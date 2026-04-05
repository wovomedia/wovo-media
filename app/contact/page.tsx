import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/cta-banner";
import { ContactSection } from "@/components/sections/contact-section";
import { PageIntro } from "@/components/sections/page-intro";
import { brand } from "@/data/site-content";
import BookingWidget from "./BookingWidget";

export const metadata: Metadata = {
  title: "Contact & Book a Meeting | Wovo Media",
  description: "Book a free 1-hour strategy session with Wovo Media. Available Mon–Sat, 12 PM–8 PM CST.",
};

export default function ContactPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Contact & Book"
        title="Let's talk about growing your business"
        description="Book a free 1-hour strategy session with Payton Cody, or reach out directly. We respond fast — usually within the hour."
        primaryCta={{ label: "Book a Meeting", href: "#book" }}
        secondaryCta={{ label: "Call / Text", href: `tel:${brand.phone}` }}
      />
      <BookingWidget />
      <ContactSection />
      <CtaBanner
        title="Need immediate help?"
        description={`Call or text ${brand.phoneDisplay} or email ${brand.email}. We respond fast — 24/7.`}
        primary={{ label: "Call Now", href: `tel:${brand.phone}` }}
        secondary={{ label: "Email Payton", href: `mailto:${brand.email}` }}
      />
    </main>
  );
}
