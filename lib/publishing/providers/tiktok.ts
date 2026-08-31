import "server-only";

import { getEnv } from "@/lib/env";
import { decryptSocialToken, encryptSocialToken } from "@/lib/publishing/crypto";
import { futureIso, jsonProviderRequest, requireStableWovoMediaUrl } from "@/lib/publishing/provider-utils";
import { updateSocialConnection } from "@/lib/publishing/store";
import type {
  ConnectionVerification,
  PublisherAdapter,
  SocialConnectionRecord,
  SocialPublishResult,
  SocialPublishStatus,
} from "@/lib/publishing/types";

type TikTokEnvelope<T> = {
  data: T;
  error?: { code?: string; message?: string; log_id?: string };
};

type TikTokToken = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type CreatorInfo = {
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

function accessToken(connection: SocialConnectionRecord) {
  return decryptSocialToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });
}

function refreshToken(connection: SocialConnectionRecord) {
  if (!connection.refresh_token_ciphertext || !connection.refresh_token_iv || !connection.refresh_token_tag) {
    throw new Error("TIKTOK_REFRESH_TOKEN_MISSING");
  }
  return decryptSocialToken({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    tag: connection.refresh_token_tag,
  });
}

async function tiktokRequest<T>(path: string, token: string, init: RequestInit = {}) {
  const payload = await jsonProviderRequest<TikTokEnvelope<T>>(
    `https://open.tiktokapis.com${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        ...init.headers,
      },
    },
    "TIKTOK",
  );
  const code = payload.error?.code ?? "ok";
  if (code !== "ok") throw new Error(`TIKTOK_${code.replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}`);
  return payload.data;
}

async function ensureTikTokAccess(connection: SocialConnectionRecord) {
  const expiresAt = Date.parse(connection.token_expires_at ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 5 * 60_000) {
    return { connection, token: accessToken(connection) };
  }
  const form = new URLSearchParams({
    client_key: getEnv("TIKTOK_CLIENT_KEY"),
    client_secret: getEnv("TIKTOK_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken(connection),
  });
  if (!form.get("client_key") || !form.get("client_secret")) throw new Error("TIKTOK_APP_NOT_CONFIGURED");
  const refreshed = await jsonProviderRequest<TikTokToken>(
    "https://open.tiktokapis.com/v2/oauth/token/",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
    "TIKTOK_OAUTH",
  );
  const access = encryptSocialToken(refreshed.access_token);
  const refresh = encryptSocialToken(refreshed.refresh_token);
  const updated = await updateSocialConnection(connection.id, {
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_token_tag: access.tag,
    refresh_token_ciphertext: refresh.ciphertext,
    refresh_token_iv: refresh.iv,
    refresh_token_tag: refresh.tag,
    token_expires_at: futureIso(refreshed.expires_in),
    refresh_token_expires_at: futureIso(refreshed.refresh_expires_in),
    scopes: refreshed.scope.split(",").map((item) => item.trim()).filter(Boolean),
    provider_user_id: refreshed.open_id,
    last_error_code: null,
    last_error_message: null,
  });
  return { connection: updated, token: refreshed.access_token };
}

async function queryCreatorInfo(token: string) {
  return tiktokRequest<CreatorInfo>("/v2/post/publish/creator_info/query/", token, {
    method: "POST",
    body: "{}",
  });
}

function currentTikTokStatus(): ConnectionVerification["status"] {
  if (getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") === "true") return "publishing_ready";
  return "test_mode";
}

export const tiktokPublisher: PublisherAdapter = {
  provider: "tiktok",

  async refreshAuthorization(connection) {
    return (await ensureTikTokAccess(connection)).connection;
  },

  async verifyConnection(connection) {
    try {
      const authorized = await ensureTikTokAccess(connection);
      const [profile, creator] = await Promise.all([
        tiktokRequest<{ user?: { open_id?: string; display_name?: string; avatar_url?: string } }>(
          "/v2/user/info/?fields=open_id,display_name,avatar_url",
          authorized.token,
          { method: "GET" },
        ),
        queryCreatorInfo(authorized.token),
      ]);
      const user = profile.user;
      return {
        ok: true,
        status: currentTikTokStatus(),
        accountId: user?.open_id ?? authorized.connection.provider_account_id,
        accountName: user?.display_name ?? creator.creator_nickname ?? authorized.connection.provider_account_name,
        scopes: authorized.connection.scopes,
        metadata: {
          creatorUsername: creator.creator_username ?? null,
          privacyLevelOptions: creator.privacy_level_options ?? [],
          commentDisabled: creator.comment_disabled ?? true,
          duetDisabled: creator.duet_disabled ?? true,
          stitchDisabled: creator.stitch_disabled ?? true,
          maxVideoPostDurationSec: creator.max_video_post_duration_sec ?? null,
          auditRequired: getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") !== "true",
        },
      };
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":")[0] : "TIKTOK_VERIFY_FAILED";
      return {
        ok: false,
        status: /TOKEN|AUTH|SCOPE/.test(code) ? "action_required" : "error",
        errorCode: code,
        userMessage: /TOKEN|AUTH/.test(code)
          ? "Reconnect TikTok to restore publishing access."
          : "TikTok could not confirm publishing access.",
      };
    }
  },

  async validatePost(request) {
    if (request.provider !== "tiktok") throw new Error("TIKTOK_PROVIDER_MISMATCH");
    if (request.publishType !== "video" || !request.mediaUrl) throw new Error("TIKTOK_VIDEO_REQUIRED");
    if (request.caption.length > 2200) throw new Error("TIKTOK_CAPTION_TOO_LONG");
    requireStableWovoMediaUrl(request.mediaUrl);
  },

  async publishPost(request, connection): Promise<SocialPublishResult> {
    await this.validatePost(request);
    const audited = getEnv("WOVO_TIKTOK_DIRECT_POST_AUDITED") === "true";
    if (audited) {
      if (getEnv("WOVO_TIKTOK_DIRECT_POST_ENABLED") !== "true") throw new Error("TIKTOK_DIRECT_POST_DISABLED");
    } else if (getEnv("WOVO_TIKTOK_TEST_POSTING_ENABLED") !== "true") {
      throw new Error("TIKTOK_PRODUCTION_AUDIT_REQUIRED");
    }
    const authorized = await ensureTikTokAccess(connection);
    const creator = await queryCreatorInfo(authorized.token);
    const allowedPrivacy = creator.privacy_level_options ?? [];
    const requestedPrivacy = audited ? (request.privacyStatus ?? "SELF_ONLY") : "SELF_ONLY";
    if (!allowedPrivacy.includes(requestedPrivacy)) throw new Error("TIKTOK_PRIVACY_OPTION_NOT_ALLOWED");
    const options = request.options ?? {};
    const initialized = await tiktokRequest<{ publish_id?: string }>(
      "/v2/post/publish/video/init/",
      authorized.token,
      {
        method: "POST",
        body: JSON.stringify({
          post_info: {
            title: request.caption,
            privacy_level: requestedPrivacy,
            disable_comment: creator.comment_disabled === true || options.allowComments === false,
            disable_duet: creator.duet_disabled === true || options.allowDuet === false,
            disable_stitch: creator.stitch_disabled === true || options.allowStitch === false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: requireStableWovoMediaUrl(request.mediaUrl!),
          },
        }),
      },
    );
    if (!initialized.publish_id) throw new Error("TIKTOK_PUBLISH_ID_MISSING");
    return { state: "processing", providerPublishId: initialized.publish_id };
  },

  async getPublishStatus(connection, providerPublishId): Promise<SocialPublishStatus> {
    const authorized = await ensureTikTokAccess(connection);
    const result = await tiktokRequest<{
      status?: string;
      fail_reason?: string;
      publicly_available_post_id?: string[];
      publicaly_available_post_id?: string[];
    }>("/v2/post/publish/status/fetch/", authorized.token, {
      method: "POST",
      body: JSON.stringify({ publish_id: providerPublishId }),
    });
    if (result.status === "PUBLISH_COMPLETE") {
      const ids = result.publicly_available_post_id ?? result.publicaly_available_post_id ?? [];
      return { state: "published", providerPostId: ids[0] ?? providerPublishId };
    }
    if (result.status === "FAILED") {
      return {
        state: "failed",
        errorCode: `TIKTOK_${String(result.fail_reason ?? "PUBLISH_FAILED").replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}`,
      };
    }
    return { state: "processing" };
  },
};
