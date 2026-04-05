export type NavLink = { label: string; href: string };
export type StatCard = { value: string; headline: string; detail: string };
export type Testimonial = { quote: string; author: string; business: string };
export type FeatureItem = { title: string; description: string };
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
  email: "Payton@wovomedia.com",
  supportEmail: "support@wovomedia.com",
  phone: "931-458-3255",
  phoneDisplay: "(931) 458-3255",
  baseLocation: "Tennessee",
  reach: "Serving businesses in all 50 states",
};

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Wovo Media AI", href: "/wovo-ai" },
  { label: "Network", href: "/wovo-ai/network" },
  { label: "Results", href: "/results" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

export const homeStats: StatCard[] = [
  {
    value: "25M+",
    headline: "Views across all clients",
    detail: "Over 25 million views across Facebook for all Wovo Media clients combined.",
  },
  {
    value: "4M+",
    headline: "Monthly views for Campbell Station",
    detail: "From zero traction to a viral local presence with consistent short-form content.",
  },
  {
    value: "8+",
    headline: "Businesses served",
    detail: "Restaurants, healthcare, farms, politics, contractors, and specialty shops.",
  },
  {
    value: "Nationwide",
    headline: "On-site filming available",
    detail: "Remote-first delivery plus travel-ready production for any U.S. market.",
  },
];

export const testimonials: Testimonial[] = [
  {
    quote: "Wovo brought our breakfast diner to life on social media. We had to start taking reservations.",
    author: "Restaurant Owner",
    business: "Campbell Station",
  },
  {
    quote: "They gave us a repeatable system for content, offers, and follow-up. We finally stopped guessing.",
    author: "Operator",
    business: "Boot Stompin' BBQ",
  },
  {
    quote: "The team made marketing simple. Their AI tools helped us post faster without sacrificing quality.",
    author: "Business Owner",
    business: "Wovo Media Client",
  },
];

export const diyFeatures: FeatureItem[] = [
  {
    title: "AI caption + image generator",
    description: "Generate platform-ready captions AND matching AI images in one click. Post-ready in under 60 seconds.",
  },
  {
    title: "Business network & collabs",
    description: "Connect with other businesses, co-create AI posts together, and grow through strategic partnerships.",
  },
  {
    title: "Content calendar & ideas",
    description: "Get a full month of content ideas, posting schedules, and engagement strategies for any industry.",
  },
  {
    title: "Ad creative studio",
    description: "Turn photos into polished ad visuals and landing-page assets ready for Facebook and Instagram.",
  },
];

export const agencyDeliverables: FeatureItem[] = [
  {
    title: "On-site filming and drone captures",
    description: "Original footage designed for reels, shorts, stories, and ad placements. Licensed & insured.",
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
    title: "Caption + Image in one click",
    description: "Type what you want to promote. Get a polished caption AND a matching AI image ready to post — no design skills needed.",
  },
  {
    title: "Business networking & AI collabs",
    description: "Connect with other businesses in the Wovo network, co-create AI posts, message partners, and grow together.",
  },
  {
    title: "Never run out of ideas",
    description: "Get scripts, hooks, posting cadence suggestions, and campaign angles tuned for your specific industry.",
  },
  {
    title: "Works for every business type",
    description: "Restaurants, chiropractors, contractors, farms, politicians, retail shops — Wovo AI adapts to any industry automatically.",
  },
];

export const processSteps: FeatureItem[] = [
  {
    title: "Discover and set goals",
    description: "We define offers, audience, and the outcomes that matter most to your business.",
  },
  {
    title: "Create and launch",
    description: "Our AI stack and creative team produce content, ads, and pages built to drive calls and bookings.",
  },
  {
    title: "Optimize and scale",
    description: "We review real performance data, double down on winners, and tighten what is underperforming.",
  },
];

export const whyWovo: FeatureItem[] = [
  {
    title: "AI-powered efficiency",
    description: "Create faster yourself or let our team deliver more output per dollar.",
  },
  {
    title: "Every industry welcome",
    description: "From restaurants and chiropractors to farms and politicians — Wovo works for everyone.",
  },
  {
    title: "Licensed, insured & drone certified",
    description: "Professional-grade production with full coverage. Based in Tennessee, filming nationwide.",
  },
  {
    title: "24/7 support always on",
    description: "No waiting until Monday. We're available evenings, weekends, and whenever you need us.",
  },
  {
    title: "Founder-led partnership",
    description: "Work directly with Payton Cody and a team focused on practical, revenue-first growth.",
  },
  {
    title: "Business network included",
    description: "Wovo AI subscribers get access to our business network to collab, share posts, and grow together.",
  },
];

export const aiPlans: Plan[] = [
  {
    name: "Starter",
    price: "$24.99/mo",
    subtitle: "7-day free trial · Cancel anytime",
    deliverables: [
      "50 AI credits / month",
      "Caption generator (all platforms)",
      "AI image generation",
      "Content ideas engine",
      "Business network access",
      "7-day free trial included",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: "/wovo-ai",
  },
  {
    name: "Growth",
    price: "$49.99/mo",
    subtitle: "7-day free trial · Most popular",
    deliverables: [
      "150 AI credits / month",
      "Everything in Starter",
      "Caption + Image workflow",
      "Saved chat history",
      "Reference image uploads",
      "Business network + messaging",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: "/wovo-ai",
  },
  {
    name: "Pro",
    price: "$99/mo",
    subtitle: "7-day free trial · Best value",
    deliverables: [
      "300 AI credits / month",
      "Priority AI generation",
      "Advanced brand voice presets",
      "Best value per credit",
      "Priority support",
      "Full network features",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: "/wovo-ai",
  },
];

export const agencyPlans: Plan[] = [
  {
    name: "Essential",
    price: "$450/mo",
    subtitle: "Great for getting started",
    deliverables: [
      "Social media strategy setup",
      "2x posts per week (managed)",
      "Monthly performance report",
      "Caption & hashtag writing",
      "Basic ad setup guidance",
    ],
    ctaLabel: "Book a Call",
    ctaHref: "/contact",
  },
  {
    name: "Starter",
    price: "$600/mo",
    subtitle: "Consistent local growth",
    deliverables: [
      "Weekly content production & edits",
      "Platform posting & optimization",
      "Monthly performance recap",
      "Conversion recommendations",
      "24/7 communication",
    ],
    ctaLabel: "Book a Call",
    ctaHref: "/contact",
  },
  {
    name: "Growth",
    price: "$800/mo",
    subtitle: "Stronger velocity & leads",
    deliverables: [
      "Everything in Starter",
      "Ad setup and audience refinement",
      "Lead capture funnel setup",
      "Campaign testing framework",
      "Bi-weekly strategy calls",
    ],
    ctaLabel: "Book a Call",
    ctaHref: "/contact",
  },
  {
    name: "Full Service",
    price: "$1,000+/mo",
    subtitle: "Complete media partnership",
    deliverables: [
      "Everything in Growth",
      "On-site filming + drone sessions",
      "Website conversion upgrades",
      "Priority strategy access",
      "Custom campaign planning",
    ],
    ctaLabel: "Book a Call",
    ctaHref: "/contact",
  },
];

export const agencyOfferNote =
  "Not sure where to start? Run a 7-day paid test for $150 and scale once performance is proven. Contact Payton@wovomedia.com or (931) 458-3255.";

export const caseStudies: CaseStudy[] = [
  {
    slug: "campbell-station",
    business: "Campbell Station Restaurant",
    industry: "Restaurant",
    location: "Culleoka, Tennessee",
    monthlyViews: "4M+ monthly views",
    challenge: "Needed consistent local awareness and a repeatable posting cadence from scratch.",
    strategy: "Built a short-form restaurant content engine, review-focused clips, and conversion-friendly offers.",
    outcomes: [
      "Scaled to millions of monthly views",
      "Improved reservation and walk-in demand",
      "Established a recognizable local brand voice",
    ],
    quote: "Wovo helped us go from quiet social pages to a packed dining room and a waitlist on weekends.",
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
    strategy: "Produced food-first short-form videos, customer review cuts, and offer-based posting cycles.",
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
    slug: "thiesing-chiropractic",
    business: "Thiesing Family Chiropractic Center",
    industry: "Healthcare",
    location: "Tennessee",
    monthlyViews: "Growing local patient reach",
    challenge: "Needed to build trust, educate patients, and attract new appointments in a competitive health market.",
    strategy: "Created educational short-form content, patient spotlight posts, and consistent community presence.",
    outcomes: [
      "Increased new patient inquiries",
      "Stronger community trust and brand recognition",
      "Consistent content publishing schedule",
    ],
    quote: "Wovo gave our practice a professional online presence that actually brings in new patients.",
    links: [],
  },
  {
    slug: "renshaw-farms",
    business: "The Ranch at Renshaw Farms",
    industry: "Farm & Venue",
    location: "Tennessee",
    monthlyViews: "Scenic drone & event coverage",
    challenge: "Needed stunning visuals to showcase the farm's beauty and attract event bookings.",
    strategy: "Drone footage, event coverage, and story-driven social content highlighting the farm experience.",
    outcomes: [
      "Increased event booking inquiries",
      "Viral drone content showcasing the property",
      "Stronger seasonal engagement",
    ],
    quote: "The drone footage alone brought us more inquiries than anything we'd done before.",
    links: [],
  },
  {
    slug: "erwin-heating-cooling",
    business: "Erwin Heating & Cooling",
    industry: "Home Services",
    location: "Columbia, Tennessee",
    monthlyViews: "Lead-focused campaign support",
    challenge: "Needed stronger local trust signals and call-driven social content.",
    strategy: "Created service-specific campaign videos, improved offer clarity, and tightened lead capture paths.",
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
  bio: "Payton founded Wovo Media to help every type of local business grow with practical AI tools and performance-focused content. From on-site drone filming across Tennessee to building Wovo AI from scratch, he leads a team focused on measurable outcomes — more calls, more bookings, more customers.",
};

export const currentClients = [
  { name: "Campbell Station Restaurant", type: "Restaurant", location: "Culleoka, TN" },
  { name: "Boot Stompin' BBQ", type: "Restaurant", location: "Columbia, TN" },
  { name: "Thiesing Family Chiropractic Center", type: "Healthcare", location: "Tennessee" },
  { name: "Maury County Mayor Sheila Butt", type: "Government", location: "Maury County, TN" },
  { name: "The Ranch at Renshaw Farms", type: "Farm & Venue", location: "Tennessee" },
  { name: "Liquid Fire Vintage Neon", type: "Specialty Retail", location: "Tennessee" },
];

export const pastClients = [
  { name: "Erwin Heating & Cooling", type: "Home Services", location: "Columbia, TN" },
  { name: "Dark Knight Contractors", type: "Contracting", location: "Tennessee" },
  { name: "Love Crust Pizza LLC", type: "Restaurant", location: "Tennessee" },
];
