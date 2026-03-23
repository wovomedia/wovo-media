export type NavLink = {
  label: string;
  href: string;
};

export type StatCard = {
  value: string;
  headline: string;
  detail: string;
};

export type Testimonial = {
  quote: string;
  author: string;
  business: string;
};

export type FeatureItem = {
  title: string;
  description: string;
};

export type Plan = {
  name: string;
  price: string;
  subtitle: string;
  deliverables: string[];
  ctaLabel: string;
  ctaHref: string;
};

export type CaseStudy = {
  slug: string;
  business: string;
  industry: string;
  location: string;
  monthlyViews: string;
  challenge: string;
  strategy: string;
  outcomes: string[];
  quote: string;
  links: Array<{ label: string; href: string }>;
};

export const brand = {
  name: "Wovo Media",
  legalName: "Wovo Media LLC",
  tagline: "Growing local businesses with content and AI.",
  email: "payton@wovomedia.com",
  phone: "931-458-3255",
  phoneDisplay: "(931) 458-3255",
  baseLocation: "Tennessee",
  reach: "Serving businesses in all 50 states",
};

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Wovo AI", href: "/wovo-ai" },
  { label: "Results", href: "/results" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

export const homeStats: StatCard[] = [
  {
    value: "4M+",
    headline: "Monthly views for Campbell Station",
    detail: "From zero traction to a viral local presence with consistent short-form content.",
  },
  {
    value: "150K+",
    headline: "Monthly views for Boot Stompin' BBQ",
    detail: "Food-focused storytelling and review clips that drove real foot traffic.",
  },
  {
    value: "10x",
    headline: "More bookings and walk-ins",
    detail: "Restaurants grow faster when creative and conversion strategy are built together.",
  },
  {
    value: "Nationwide",
    headline: "On-site filming when needed",
    detail: "Remote-first delivery plus travel-ready production for any U.S. market.",
  },
];

// TODO: Replace with approved client quotes and logos once usage rights are confirmed.
export const testimonials: Testimonial[] = [
  {
    quote:
      "Wovo brought our breakfast diner to life on social media. We had to start taking reservations.",
    author: "Restaurant Owner",
    business: "Campbell Station",
  },
  {
    quote:
      "They gave us a repeatable system for content, offers, and follow-up. We finally stopped guessing.",
    author: "Operator",
    business: "Boot Stompin' BBQ",
  },
  {
    quote:
      "The team made marketing simple. Their AI tools helped us post faster without sacrificing quality.",
    author: "Small Business Owner",
    business: "Middle Tennessee Client",
  },
];

export const diyFeatures: FeatureItem[] = [
  {
    title: "AI caption and idea generator",
    description: "Generate platform-ready post ideas, hooks, and captions tailored to your audience.",
  },
  {
    title: "AI spokesperson videos",
    description:
      "Record your face and voice once, then produce on-brand promos and announcements in minutes.",
  },
  {
    title: "Ad creative studio",
    description: "Turn food or product photos into polished ad visuals and landing-page assets.",
  },
  {
    title: "Mascot and brand character options",
    description: "Create distinctive visual assets that make your business instantly recognizable.",
  },
];

export const agencyDeliverables: FeatureItem[] = [
  {
    title: "On-site filming and drone captures",
    description: "Original footage designed for reels, shorts, stories, and ad placements.",
  },
  {
    title: "Weekly posting and editing",
    description: "Consistent distribution with performance-minded short-form edits and captions.",
  },
  {
    title: "Ad setup and always-on lead capture",
    description: "Paid campaigns, conversion forms, and follow-up flow tuning.",
  },
  {
    title: "Website conversion upgrades",
    description: "Landing pages and conversion improvements that turn viewers into customers.",
  },
];

export const aiFeatureCards: FeatureItem[] = [
  {
    title: "Record once, create forever",
    description:
      "Upload one clip or use your webcam. Wovo AI builds event promos, review-style videos, and seasonal offers using your voice and face with consent.",
  },
  {
    title: "Never run out of ideas",
    description:
      "Get scripts, hooks, posting cadence suggestions, and campaign angles tuned for restaurants and service businesses.",
  },
  {
    title: "Turn photos into ad-ready assets",
    description:
      "Drag and drop food, product, or team photos to create ad creatives and landing-page visuals fast.",
  },
  {
    title: "Build a brand character system",
    description:
      "Create mascots and character variations you can reuse across social content, ads, and on-site signage mockups.",
  },
];

export const processSteps: FeatureItem[] = [
  {
    title: "Discover and goals",
    description: "We define offers, audience, and the outcomes that matter most to your business.",
  },
  {
    title: "Create and launch",
    description:
      "Our AI stack and creative team produce content, ads, and pages built to drive calls and bookings.",
  },
  {
    title: "Optimize and scale",
    description:
      "We review real performance data, double down on winners, and tighten what is underperforming.",
  },
];

export const whyWovo: FeatureItem[] = [
  {
    title: "AI-powered efficiency",
    description: "Create faster yourself or let our team deliver more output per dollar.",
  },
  {
    title: "Restaurant-first playbooks",
    description: "Frameworks tested on real food and hospitality clients with measurable outcomes.",
  },
  {
    title: "Nationwide with travel support",
    description: "Based in Tennessee, operating across the U.S., with on-site production available.",
  },
  {
    title: "Flexible engagement path",
    description: "Start with DIY and upgrade later, or begin with full-service execution on day one.",
  },
  {
    title: "Founder-led partnership",
    description: "Work directly with Payton Cody and a team focused on practical, revenue-first growth.",
  },
];

export const aiPlans: Plan[] = [
  {
    name: "Wovo AI Starter",
    price: "$49/mo",
    subtitle: "For owners who want to create daily content quickly.",
    deliverables: [
      "AI caption and angle generator",
      "Social-ready script and post prompts",
      "Basic ad visual generation",
      "Weekly content planning tools",
    ],
    ctaLabel: "Start Starter Plan",
    ctaHref: "/contact",
  },
  {
    name: "Wovo AI Pro",
    price: "$249/mo",
    subtitle: "For teams running more campaigns and creative formats.",
    deliverables: [
      "Advanced AI spokesperson generation",
      "Expanded ad and landing-page assets",
      "Brand character and mascot tools",
      "Priority support and guidance",
    ],
    ctaLabel: "Start Pro Plan",
    ctaHref: "/contact",
  },
];

export const agencyPlans: Plan[] = [
  {
    name: "Starter",
    price: "$600/mo",
    subtitle: "Consistent output for local growth and trust.",
    deliverables: [
      "Weekly content production and edits",
      "Platform posting and optimization",
      "Monthly performance recap",
      "Conversion recommendations",
    ],
    ctaLabel: "Book Starter",
    ctaHref: "/contact",
  },
  {
    name: "Growth",
    price: "$800/mo",
    subtitle: "Stronger campaign velocity and lead generation.",
    deliverables: [
      "Everything in Starter",
      "Ad setup and audience refinement",
      "Lead capture funnel setup",
      "Campaign testing framework",
    ],
    ctaLabel: "Book Growth",
    ctaHref: "/contact",
  },
  {
    name: "Full",
    price: "$1,000+/mo",
    subtitle: "Full-service media and conversion support.",
    deliverables: [
      "Everything in Growth",
      "On-site filming and drone sessions",
      "Website conversion upgrades",
      "Priority strategy and support",
    ],
    ctaLabel: "Book Full",
    ctaHref: "/contact",
  },
];

export const agencyOfferNote =
  "Not sure where to start? Run a 7-day paid test for $150 and scale once performance is proven.";

export const caseStudies: CaseStudy[] = [
  {
    slug: "campbell-station",
    business: "Campbell Station",
    industry: "Restaurant",
    location: "Culleoka, Tennessee",
    monthlyViews: "4M+ monthly views",
    challenge: "Needed consistent local awareness and a repeatable posting cadence from scratch.",
    strategy:
      "Built a short-form restaurant content engine, review-focused clips, and conversion-friendly offers.",
    outcomes: [
      "Scaled to millions of monthly views",
      "Improved reservation and walk-in demand",
      "Established a recognizable local brand voice",
    ],
    quote:
      "Wovo helped us go from quiet social pages to a packed dining room and a waitlist on weekends.",
    links: [
      { label: "Facebook", href: "https://www.facebook.com/CampbellStationRestaurant/" },
      { label: "Website", href: "https://thecampbellstation.com/" },
    ],
  },
  {
    slug: "boot-stompin-bbq",
    business: "Boot Stompin' BBQ",
    industry: "Restaurant",
    location: "Columbia, Tennessee",
    monthlyViews: "150K+ monthly views",
    challenge: "Needed stronger awareness for promos, catering, and repeat visits.",
    strategy:
      "Produced food-first short-form videos, customer review cuts, and offer-based posting cycles.",
    outcomes: [
      "Increased monthly local visibility",
      "More inbound catering and booking messages",
      "Improved consistency in content output",
    ],
    quote: "The content got people through the door. We could feel the difference each week.",
    links: [
      { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61569065816720" },
      { label: "Website", href: "https://bootstompinbbq.co/" },
    ],
  },
  {
    slug: "erwin-heating-cooling",
    business: "Erwin Heating & Cooling",
    industry: "Home Services",
    location: "Columbia, Tennessee",
    monthlyViews: "Lead-focused campaign support",
    challenge: "Needed stronger local trust signals and call-driven social content.",
    strategy:
      "Created service-specific campaign videos, improved offer clarity, and tightened lead capture paths.",
    outcomes: [
      "Higher consistency in inbound lead quality",
      "Stronger local brand credibility",
      "More actionable campaign reporting",
    ],
    quote: "Wovo gave us structure and momentum. Marketing finally felt measurable.",
    links: [{ label: "Facebook", href: "https://www.facebook.com/profile.php?id=61585412455842" }],
  },
];

export const founder = {
  name: "Payton Cody",
  title: "Founder and CEO",
  bio: "Payton founded Wovo Media to help local businesses grow with practical AI tools and performance-focused content. From on-site filming in small towns to building in-house AI workflows, he leads a team focused on measurable outcomes instead of vanity metrics.",
};
