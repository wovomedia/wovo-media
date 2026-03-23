import { AIFeatureSection } from "@/components/sections/ai-feature-section";
import { CaseStudyPreviewSection } from "@/components/sections/case-study-preview-section";
import { ClosingCtaSection } from "@/components/sections/closing-cta-section";
import { ContactSection } from "@/components/sections/contact-section";
import { FounderSection } from "@/components/sections/founder-section";
import { HeroSection } from "@/components/sections/hero-section";
import { ProcessSection } from "@/components/sections/process-section";
import { ResultsSection } from "@/components/sections/results-section";
import { ServicePathsSection } from "@/components/sections/service-paths-section";
import { WhyWovoSection } from "@/components/sections/why-wovo-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ResultsSection />
      <ServicePathsSection />
      <AIFeatureSection />
      <ProcessSection />
      <WhyWovoSection />
      <CaseStudyPreviewSection />
      <FounderSection />
      <ClosingCtaSection />
      <ContactSection compact />
    </main>
  );
}
