import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { META_FACEBOOK_LOGIN_PERMISSIONS, metaRedirectUrl } from "@/lib/meta/integration";
import { socialEncryptionConfigured, socialRedirectUrl } from "@/lib/publishing/oauth";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MetaRow = {
  page_name: string;
  instagram_username: string | null;
  status: string;
  granted_scopes: string[];
  token_expires_at: string | null;
  last_checked_at: string | null;
  last_error_code: string | null;
  e2e_verified_at: string | null;
};
type SocialRow = {
  provider: string;
  provider_account_name: string;
  status: string;
  scopes: string[];
  token_expires_at: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
};

function configured(name: string) { return Boolean(getEnv(name)); }
function price(name: string) { const value = getEnv(name); return value ? { env: name, priceId: value } : { env: name, priceId: null }; }

export async function GET(request: Request) {
  try {
    await requireAdminUser(request.headers.get("authorization"));
    const origin = (getEnv("NEXT_PUBLIC_SITE_URL") || new URL(request.url).origin).replace(/\/$/, "");
    const [metaConnections, socialConnections, metaJobs, videoJobs, musicJobs, usage, stripeEvents, creditPacks] = await Promise.all([
      supabaseServiceRoleRequest<MetaRow[]>("/rest/v1/wovo_meta_connections?select=page_name,instagram_username,status,granted_scopes,token_expires_at,last_checked_at,last_error_code,e2e_verified_at&order=updated_at.desc&limit=100").catch(() => []),
      supabaseServiceRoleRequest<SocialRow[]>("/rest/v1/wovo_social_connections?select=provider,provider_account_name,status,scopes,token_expires_at,last_verified_at,last_error_code&disconnected_at=is.null&order=updated_at.desc&limit=200").catch(() => []),
      supabaseServiceRoleRequest<Array<{ destination: string; status: string; provider_post_id: string | null; published_at: string | null; last_error_code: string | null; updated_at: string }>>("/rest/v1/wovo_meta_publish_jobs?select=destination,status,provider_post_id,published_at,last_error_code,updated_at&order=updated_at.desc&limit=20").catch(() => []),
      supabaseServiceRoleRequest<Array<{ status: string; provider: string; provider_job_id: string | null; error: string | null; updated_at: string }>>("/rest/v1/video_jobs?select=status,provider,provider_job_id,error,updated_at&order=updated_at.desc&limit=1").catch(() => []),
      supabaseServiceRoleRequest<Array<{ status: string; provider: string; provider_job_id: string | null; error: string | null; quality: string; model: string; updated_at: string }>>("/rest/v1/wovo_music_jobs?select=status,provider,provider_job_id,error,quality,model,updated_at&order=updated_at.desc&limit=1").catch(() => []),
      supabaseServiceRoleRequest<Array<{ feature: string; status: string; error_code: string | null; completed_at: string | null; reserved_at: string }>>("/rest/v1/wovo_ai_usage_requests?select=feature,status,error_code,completed_at,reserved_at&order=reserved_at.desc&limit=10").catch(() => []),
      supabaseServiceRoleRequest<Array<{ event_type: string; processed_at: string | null; created_at: string }>>("/rest/v1/wovo_portal_stripe_events?select=event_type,processed_at,created_at&order=created_at.desc&limit=1").catch(() => []),
      supabaseServiceRoleRequest<Array<{ pack_key: string; display_name: string; stripe_price_id: string; units: number; amount_cents: number; active: boolean }>>("/rest/v1/wovo_credit_packs?select=pack_key,display_name,stripe_price_id,units,amount_cents,active&active=eq.true&order=amount_cents.asc").catch(() => []),
    ]);
    const requiredFacebookScopes = [...META_FACEBOOK_LOGIN_PERMISSIONS];
    const metaReady = (metaConnections ?? []).map((row) => ({
      account: row.page_name,
      instagram: row.instagram_username,
      status: row.status,
      tokenExpiresAt: row.token_expires_at,
      lastCheckedAt: row.last_checked_at,
      lastErrorCode: row.last_error_code,
      e2eProviderProof: Boolean(row.e2e_verified_at),
      missingScopes: requiredFacebookScopes.filter((scope) => !row.granted_scopes.includes(scope)),
    }));
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      audience: "wovo_admin_only",
      generation: {
        falConfigured: configured("FAL_API_KEY") || configured("FAL_KEY"),
        openAiConfigured: configured("OPENAI_API_KEY"),
        storageConfigured: configured("NEXT_PUBLIC_SUPABASE_URL") && (configured("SUPABASE_SECRET_KEY") || configured("SUPABASE_SERVICE_ROLE_KEY")),
        videoGenerationEnabled: getEnv("WOVO_VIDEO_GENERATION_ENABLED") === "true",
        musicGenerationEnabled: getEnv("WOVO_MUSIC_GENERATION_ENABLED") === "true",
        mediaSigningConfigured: configured("WOVO_MEDIA_SIGNING_KEY") || configured("CRON_SECRET"),
        lastVideoJob: videoJobs?.[0] ?? null,
        lastMusicJob: musicJobs?.[0] ?? null,
        lastUsage: usage?.[0] ?? null,
      },
      meta: {
        appConfigured: configured("META_APP_ID") && configured("META_APP_SECRET"),
        facebookOAuthConfigured: configured("META_LOGIN_CONFIG_ID"),
        callbackUrl: metaRedirectUrl(origin),
        requiredScopes: requiredFacebookScopes,
        connections: metaReady,
        lastPublishJobs: metaJobs ?? [],
      },
      tiktok: {
        appConfigured: configured("TIKTOK_CLIENT_KEY") && configured("TIKTOK_CLIENT_SECRET") && socialEncryptionConfigured(),
        contentPostingEnabled: getEnv("WOVO_TIKTOK_DIRECT_POST_ENABLED") === "true",
        callbackUrl: socialRedirectUrl(origin, "tiktok"),
        requiredScopes: ["user.info.basic", "video.publish"],
        clientAuditComplete: getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") === "true",
        mediaHost: getEnv("WOVO_SOCIAL_MEDIA_HOST") || "wovomedia.com",
        connections: (socialConnections ?? []).filter((row) => row.provider === "tiktok"),
      },
      youtube: {
        cloudOAuthConfigured: configured("GOOGLE_YOUTUBE_CLIENT_ID") && configured("GOOGLE_YOUTUBE_CLIENT_SECRET") && socialEncryptionConfigured(),
        dataApiEnabled: getEnv("WOVO_YOUTUBE_DATA_API_ENABLED") === "true",
        callbackUrl: socialRedirectUrl(origin, "youtube"),
        requiredScopes: ["https://www.googleapis.com/auth/youtube.upload"],
        oauthVerificationComplete: getEnv("WOVO_YOUTUBE_OAUTH_VERIFIED") === "true",
        apiAuditComplete: getEnv("WOVO_YOUTUBE_API_AUDITED") === "true",
        connections: (socialConnections ?? []).filter((row) => row.provider === "youtube"),
      },
      stripe: {
        configured: configured("STRIPE_SECRET_KEY") && configured("STRIPE_WEBHOOK_SECRET"),
        webhookUrl: `${origin}/api/stripe/webhook`,
        lastWebhook: stripeEvents?.[0] ?? null,
        planPrices: [
          price("WOVO_PORTAL_MONTHLY_PRICE_ID"), price("WOVO_PORTAL_QUARTERLY_PRICE_ID"),
          price("WOVO_PORTAL_SEMIANNUAL_PRICE_ID"), price("WOVO_PORTAL_YEARLY_PRICE_ID"),
        ],
        creditPacks: creditPacks ?? [],
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
