import type { Metadata } from "next";
import PricingExperience from "./PricingExperience";

export const metadata: Metadata = {
  title: "WOVO Pricing — Plans and Pay-As-You-Go Credits",
  description: "Start with 10 free WOVO Credits, choose a monthly creation plan, or buy credits without a subscription. Exact generation costs are shown before you create.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return <PricingExperience />;
}
