export type NavLink = { label: string; href: string };
export type FeatureItem = { title: string; description: string };
export type Plan = {
  name: string;
  price: string;
  subtitle: string;
  deliverables: string[];
  ctaLabel: string;
  ctaHref: string;
  previewImage?: string;
  previewAlt?: string;
  previewPoints?: string[];
  previewBadge?: string;
};

export const brand = {
  name: "WOVO Media",
  legalName: "WOVO Media LLC",
  tagline: "A weekly marketing workspace for independent businesses.",
  email: "support@wovomedia.com",
  supportEmail: "support@wovomedia.com",
  phone: "",
  phoneDisplay: "",
  baseLocation: "",
  reach: "Serving businesses worldwide",
  logoIcon: "/icon.svg",
  logoWordmark: "/icon.svg",
};

export const payments = {
  aiStarterCheckout: "/signup?next=/portal",
  aiProCheckout: "/signup?next=/portal",
  agencyGrowthCheckout: "/contact",
  agencyPremiumCheckout: "/contact",
};

export const navLinks: NavLink[] = [
  { label: "Product", href: "/product" },
  { label: "Workflow", href: "/workflow" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Support", href: "/contact" },
];

export const timelineSteps = [
  { step: "01", title: "Set the operating context", description: "Capture the business, audience, offers, voice, cadence, and approved assets." },
  { step: "02", title: "Build the week", description: "Draft ideas and captions into one visible calendar and approval queue." },
  { step: "03", title: "Review and ship", description: "Approve, revise, copy, and mark work posted with a human in the loop." },
];

export const diyFeatures: FeatureItem[] = [
  { title: "Brand profile", description: "Keep voice, audiences, offers, and approved business context together." },
  { title: "Weekly plan", description: "Generate a practical cadence and time-bounded queue for review." },
  { title: "Private asset library", description: "Store business-owned photos and videos inside a tenant-scoped workspace." },
  { title: "Shared WOVO support", description: "Open private cases with the organization rather than individual staff accounts." },
];

export const agencyDeliverables: FeatureItem[] = [
  { title: "On-site production", description: "Photo and video shoots are separately scoped, scheduled, and priced." },
  { title: "Commercial drone work", description: "Availability, travel, airspace, weather, and operating compliance require staff review." },
  { title: "Website projects", description: "Bespoke website work is quoted separately from the software subscription." },
  { title: "Custom editing", description: "Additional specialist and editing time is approved and billed as an add-on." },
];

export const aiFeatureCards: FeatureItem[] = diyFeatures;
export const processSteps: FeatureItem[] = timelineSteps.map(({ title, description }) => ({ title, description }));
export const whyWovo: FeatureItem[] = [
  { title: "One operating view", description: "Content, calendar, assets, bookings, billing, and support stay organized." },
  { title: "Human approval", description: "Generated work enters a review queue; publishing is not silently automated." },
  { title: "Clear service boundaries", description: "The software plan and human production services are priced separately." },
];

export const aiPlans: Plan[] = [
  {
    name: "WOVO Workspace",
    price: "From $15/month",
    subtitle: "Automation-first software subscription",
    deliverables: [
      "Business and brand profile",
      "Content ideas and caption drafts",
      "Weekly calendar and approval queue",
      "Private asset library",
      "Client support workspace",
      "Stripe billing controls",
    ],
    ctaLabel: "Create account",
    ctaHref: "/signup?next=/portal",
  },
];

export const agencyPlans: Plan[] = [];
export const agencyOfferNote = "Human production services are scoped and quoted separately.";
export const founder = {
  name: "WOVO Media",
  title: "Product and service team",
  bio: "WOVO combines a self-directed weekly marketing workspace with optional, separately scoped human production services.",
};
