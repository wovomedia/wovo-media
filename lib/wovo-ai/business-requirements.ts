import type { BusinessProfile } from "@/lib/wovo-ai/business-profiles";

/**
 * Asset requirements for a business profile.
 *
 * Every business must supply a logo. Food-service businesses must additionally
 * supply photos of their food — generated food imagery is the single worst
 * failure mode for restaurant marketing, because a plate that isn't theirs
 * reads as false advertising to their customers.
 *
 * Kept deliberately free of React and of server-only imports so the same rules
 * run in the onboarding UI and in the API route that persists the profile.
 * Client-side validation is a convenience; the server check is the real gate.
 */

export const MIN_FOOD_PHOTOS = 3;
export const MAX_FOOD_PHOTOS = 12;

/**
 * Matched against the free-text `businessType` field, so it has to tolerate
 * whatever the user typed. Substring matching on a lowercased value.
 */
const FOOD_SERVICE_KEYWORDS = [
  "restaurant",
  "cafe",
  "café",
  "coffee",
  "bakery",
  "bar",
  "pub",
  "brewery",
  "diner",
  "bistro",
  "deli",
  "catering",
  "caterer",
  "food truck",
  "foodtruck",
  "pizzeria",
  "pizza",
  "grill",
  "steakhouse",
  "sushi",
  "taqueria",
  "juice",
  "smoothie",
  "ice cream",
  "creamery",
  "dessert",
  "patisserie",
  "sandwich",
  "bbq",
  "barbecue",
  "buffet",
  "eatery",
  "kitchen",
] as const;

export function isFoodServiceBusiness(businessType: string | null | undefined): boolean {
  const value = (businessType ?? "").trim().toLowerCase();
  if (!value) return false;
  return FOOD_SERVICE_KEYWORDS.some((keyword) => value.includes(keyword));
}

export type RequirementCode = "logo_required" | "food_photos_required";

export type RequirementIssue = {
  code: RequirementCode;
  field: "logoUrl" | "foodPhotoUrls";
  message: string;
};

type ValidatableProfile = Pick<BusinessProfile, "businessType" | "logoUrl"> & {
  foodPhotoUrls?: string[];
};

/**
 * Returns every unmet requirement rather than the first, so the UI can show the
 * user the full list in one pass instead of drip-feeding one error at a time.
 */
export function findMissingRequirements(profile: ValidatableProfile): RequirementIssue[] {
  const issues: RequirementIssue[] = [];

  if (!profile.logoUrl?.trim()) {
    issues.push({
      code: "logo_required",
      field: "logoUrl",
      message: "Add your business logo. It appears on generated posts and ads.",
    });
  }

  if (isFoodServiceBusiness(profile.businessType)) {
    const photos = (profile.foodPhotoUrls ?? []).filter((url) => url.trim().length > 0);
    if (photos.length < MIN_FOOD_PHOTOS) {
      const remaining = MIN_FOOD_PHOTOS - photos.length;
      issues.push({
        code: "food_photos_required",
        field: "foodPhotoUrls",
        message:
          `Add ${remaining} more photo${remaining === 1 ? "" : "s"} of your food ` +
          `(${MIN_FOOD_PHOTOS} minimum). WOVO uses your real dishes rather than ` +
          `generating food images, so your ads match what you actually serve.`,
      });
    }
  }

  return issues;
}

export function isProfileComplete(profile: ValidatableProfile): boolean {
  return findMissingRequirements(profile).length === 0;
}

/** Human-readable checklist for the onboarding UI, before anything is uploaded. */
export function describeRequirements(businessType: string | null | undefined): string[] {
  const requirements = ["A business logo"];
  if (isFoodServiceBusiness(businessType)) {
    requirements.push(`At least ${MIN_FOOD_PHOTOS} photos of your food`);
  }
  return requirements;
}
