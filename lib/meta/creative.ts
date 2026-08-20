import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export type WovoDailyCreative = {
  campaignKey: string;
  kicker: string;
  headline: string;
  cta: string;
  caption: string;
  hashtags: string[];
};

const DAILY_CREATIVES: WovoDailyCreative[] = [
  {
    campaignKey: "cartoon-series",
    kicker: "A recurring brand character",
    headline: "Three original cartoon episodes every week.",
    cta: "$39.99/month · Review before publishing",
    caption: "Give your business a character people recognize. WOVO prepares three original vertical cartoon episodes each week from an approved character brief, with private review before anything is published. The Cartoon Episodes add-on is $39.99/month. Learn more at wovomedia.com/cartoon-episodes. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#BrandCharacter", "#ContentMarketing"],
  },
  {
    campaignKey: "weekly-queue",
    kicker: "A calmer content rhythm",
    headline: "Plan the week. Review the work. Keep moving.",
    cta: "WOVO Media · Serving businesses worldwide",
    caption: "WOVO gives independent businesses one organized place for brand context, content drafts, approvals, schedules, and support. Automation prepares the work; people stay in control of what goes public. Explore the workflow at wovomedia.com/product. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#MarketingWorkflow", "#SmallBusinessMarketing"],
  },
  {
    campaignKey: "local-business-os",
    kicker: "Built for real operating weeks",
    headline: "Marketing should feel like a system—not another chore.",
    cta: "Create · Approve · Schedule · Measure",
    caption: "WOVO is a marketing operating system for local businesses: a useful brand profile, a weekly content queue, clear approvals, scheduling, and a human support path when you need it. See how it works at wovomedia.com/workflow. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#LocalBusinessMarketing", "#ContentPlanning"],
  },
  {
    campaignKey: "brand-assets",
    kicker: "Your brand stays yours",
    headline: "Approved assets in. On-brand drafts out.",
    cta: "Private workspace · Rights-aware workflow",
    caption: "Organize business-owned photos, videos, voice, colors, and approved facts once. WOVO uses that private workspace context to prepare more consistent drafts without mixing one business’s information with another. Learn more at wovomedia.com/product. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#BrandAssets", "#BrandConsistency"],
  },
  {
    campaignKey: "human-control",
    kicker: "Automation with a review step",
    headline: "Nothing should publish by accident.",
    cta: "Draft first · Approval-aware publishing",
    caption: "WOVO separates drafting from publishing. Connected accounts use official authorization, work is traceable, and publishing follows the policy the workspace owner selected. Start at wovomedia.com. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#ContentApproval", "#SocialMediaWorkflow"],
  },
  {
    campaignKey: "website-concepts",
    kicker: "From scattered ideas to a clear brief",
    headline: "Turn your brand into a website plan you can review.",
    cta: "Structure · Copy · Visual direction",
    caption: "WOVO helps businesses turn approved brand context into editable website concepts, page plans, and project requests. Drafts stay drafts until hosting and publishing are explicitly authorized. Visit wovomedia.com/services. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#WebsitePlanning", "#SmallBusinessWebsite"],
  },
  {
    campaignKey: "team-inbox",
    kicker: "One private place to ask for help",
    headline: "Your request reaches WOVO—not a staff member’s personal inbox.",
    cta: "Private cases · Clear ownership · Tracked replies",
    caption: "Clients can message WOVO through a private team inbox with a clear case reference, assignment history, and accountable follow-up—without exposing individual staff accounts. Contact WOVO at wovomedia.com/contact. — Adam, WOVO Media AI Operations Assistant",
    hashtags: ["#WOVOMedia", "#ClientSupport", "#BusinessOperations"],
  },
];

const CAPTION_FRAMES = [
  "A practical marketing system starts with one clear next step.",
  "Consistency is easier when the workflow is visible.",
  "Strong content begins with approved facts and owned assets.",
  "A useful marketing week should be simple to review.",
  "The goal is dependable progress without losing human control.",
  "Good automation prepares the work and preserves the decision.",
  "Clear context produces more useful drafts.",
  "Every public post should have a traceable source and status.",
] as const;

export function creativeForDate(date: string, slotIndex = 0): WovoDailyCreative {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const base = DAILY_CREATIVES[Math.abs(dayNumber * 3 + slotIndex) % DAILY_CREATIVES.length];
  const frame = CAPTION_FRAMES[Math.abs(dayNumber + slotIndex * 5) % CAPTION_FRAMES.length];
  return {
    ...base,
    caption: `${frame} ${base.caption}\n\n${base.hashtags.join(" ")}\n\nSent by Adam Carter, WOVO Media's AI COO / Operations Assistant. Adam is an AI-generated representative, not a human employee.`,
  };
}

function signingKey() {
  const value = getEnv("META_TOKEN_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("META_CREATIVE_SIGNING_KEY_MISSING");
  return value;
}

export function signMetaCreative(jobId: string) {
  return createHmac("sha256", signingKey()).update(`wovo-meta-creative:${jobId}`).digest("hex");
}

export function verifyMetaCreativeSignature(jobId: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signMetaCreative(jobId), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
