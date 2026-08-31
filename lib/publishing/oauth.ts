import "server-only";

import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, isUuid, PortalHttpError, requirePortalContext } from "@/lib/portal/server";
import type { SocialProvider } from "@/lib/publishing/types";

export async function resolveSocialOAuthTarget(authHeader: string | null, accountId: unknown) {
  const context = await requirePortalContext(authHeader);
  const ownerScope = !accountId && context.mode === "staff" && context.staffRole === "owner";
  if (!ownerScope && !isUuid(accountId)) throw new PortalHttpError(400, "A valid workspace is required.");
  if (!ownerScope) await assertPortalAccountAccess(context, accountId as string);
  return { context, ownerScope, workspaceId: ownerScope ? null : accountId as string };
}

export function socialRedirectUrl(origin: string, provider: SocialProvider) {
  const siteUrl = (getEnv("NEXT_PUBLIC_SITE_URL") || origin).replace(/\/$/, "");
  return `${siteUrl}/api/integrations/${provider}/callback`;
}

export function socialReturnUrl(origin: string, result: string) {
  const siteUrl = (getEnv("NEXT_PUBLIC_SITE_URL") || origin).replace(/\/$/, "");
  return `${siteUrl}/portal?social=${encodeURIComponent(result)}`;
}

export function socialEncryptionConfigured() {
  return /^[a-f0-9]{64}$/i.test(getEnv("WOVO_SOCIAL_TOKEN_ENCRYPTION_KEY"));
}
