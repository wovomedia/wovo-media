import "server-only";

import { getEnv } from "@/lib/env";
import { decryptSocialToken, encryptSocialToken } from "@/lib/publishing/crypto";
import { futureIso, jsonProviderRequest, requireStableWovoMediaUrl } from "@/lib/publishing/provider-utils";
import { updateSocialConnection } from "@/lib/publishing/store";
import type {
  PublisherAdapter,
  SocialConnectionRecord,
  SocialPublishResult,
  SocialPublishStatus,
} from "@/lib/publishing/types";

const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const MAX_YOUTUBE_UPLOAD_BYTES = 128 * 1024 * 1024;

type GoogleToken = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
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
    throw new Error("YOUTUBE_REFRESH_TOKEN_MISSING");
  }
  return decryptSocialToken({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    tag: connection.refresh_token_tag,
  });
}

async function ensureYouTubeAccess(connection: SocialConnectionRecord) {
  const expiresAt = Date.parse(connection.token_expires_at ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 5 * 60_000) {
    return { connection, token: accessToken(connection) };
  }
  const form = new URLSearchParams({
    client_id: getEnv("GOOGLE_YOUTUBE_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_YOUTUBE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken(connection),
  });
  if (!form.get("client_id") || !form.get("client_secret")) throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
  const refreshed = await jsonProviderRequest<GoogleToken>(
    "https://oauth2.googleapis.com/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
    "YOUTUBE_OAUTH",
  );
  const access = encryptSocialToken(refreshed.access_token);
  const updated = await updateSocialConnection(connection.id, {
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_token_tag: access.tag,
    token_expires_at: futureIso(refreshed.expires_in),
    scopes: refreshed.scope?.split(" ").filter(Boolean) ?? connection.scopes,
    last_error_code: null,
    last_error_message: null,
  });
  return { connection: updated, token: refreshed.access_token };
}

async function youtubeJson<T>(url: string, token: string, init: RequestInit = {}) {
  return jsonProviderRequest<T>(
    url,
    { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } },
    "YOUTUBE",
  );
}

function youtubeRuntimeStatus() {
  return getEnv("WOVO_YOUTUBE_OAUTH_VERIFIED") === "true" && getEnv("WOVO_YOUTUBE_API_AUDITED") === "true"
    ? "publishing_ready" as const
    : "test_mode" as const;
}

export const youtubePublisher: PublisherAdapter = {
  provider: "youtube",

  async refreshAuthorization(connection) {
    return (await ensureYouTubeAccess(connection)).connection;
  },

  async verifyConnection(connection) {
    try {
      const authorized = await ensureYouTubeAccess(connection);
      const result = await youtubeJson<{
        items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string; thumbnails?: unknown } }>;
      }>("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", authorized.token);
      const channel = result.items?.[0];
      if (!channel?.id) throw new Error("YOUTUBE_CHANNEL_NOT_FOUND");
      const hasUploadScope = authorized.connection.scopes.includes(YOUTUBE_UPLOAD_SCOPE);
      return {
        ok: hasUploadScope,
        status: hasUploadScope ? youtubeRuntimeStatus() : "action_required",
        accountId: channel.id,
        accountName: channel.snippet?.title ?? authorized.connection.provider_account_name,
        scopes: authorized.connection.scopes,
        metadata: {
          customUrl: channel.snippet?.customUrl ?? null,
          uploadScopeGranted: hasUploadScope,
          oauthVerificationRequired: getEnv("WOVO_YOUTUBE_OAUTH_VERIFIED") !== "true",
          apiAuditRequired: getEnv("WOVO_YOUTUBE_API_AUDITED") !== "true",
        },
        errorCode: hasUploadScope ? undefined : "YOUTUBE_UPLOAD_SCOPE_MISSING",
        userMessage: hasUploadScope ? undefined : "Reconnect YouTube and approve video uploads.",
      };
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":")[0] : "YOUTUBE_VERIFY_FAILED";
      return {
        ok: false,
        status: /TOKEN|AUTH|SCOPE/.test(code) ? "action_required" : "error",
        errorCode: code,
        userMessage: /TOKEN|AUTH/.test(code)
          ? "Reconnect YouTube to restore publishing access."
          : "YouTube could not confirm channel access.",
      };
    }
  },

  async validatePost(request) {
    if (request.provider !== "youtube") throw new Error("YOUTUBE_PROVIDER_MISMATCH");
    if (request.publishType !== "video" || !request.mediaUrl) throw new Error("YOUTUBE_VIDEO_REQUIRED");
    if (!request.title?.trim()) throw new Error("YOUTUBE_TITLE_REQUIRED");
    if (request.title.length > 100) throw new Error("YOUTUBE_TITLE_TOO_LONG");
    if (request.caption.length > 5000) throw new Error("YOUTUBE_DESCRIPTION_TOO_LONG");
    requireStableWovoMediaUrl(request.mediaUrl);
  },

  async publishPost(request, connection): Promise<SocialPublishResult> {
    await this.validatePost(request);
    if (getEnv("WOVO_YOUTUBE_PUBLISHING_ENABLED") !== "true") throw new Error("YOUTUBE_PUBLISHING_DISABLED");
    const audited = getEnv("WOVO_YOUTUBE_API_AUDITED") === "true";
    const requestedPrivacy = request.privacyStatus ?? "private";
    if (!audited && requestedPrivacy !== "private") throw new Error("YOUTUBE_API_AUDIT_REQUIRED_FOR_PUBLIC_UPLOAD");
    if (!audited && getEnv("WOVO_YOUTUBE_TEST_UPLOADS_ENABLED") !== "true") throw new Error("YOUTUBE_TEST_UPLOADS_DISABLED");
    if (!new Set(["private", "unlisted", "public"]).has(requestedPrivacy)) throw new Error("YOUTUBE_PRIVACY_INVALID");

    const authorized = await ensureYouTubeAccess(connection);
    const mediaUrl = requireStableWovoMediaUrl(request.mediaUrl!);
    const mediaResponse = await fetch(mediaUrl, { cache: "no-store" });
    if (!mediaResponse.ok) throw new Error(`YOUTUBE_MEDIA_FETCH_${mediaResponse.status}`);
    const contentLength = Number(mediaResponse.headers.get("content-length") ?? 0);
    if (contentLength > MAX_YOUTUBE_UPLOAD_BYTES) throw new Error("YOUTUBE_MEDIA_TOO_LARGE_FOR_WOVO_SHORTS_FLOW");
    const bytes = Buffer.from(await mediaResponse.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_YOUTUBE_UPLOAD_BYTES) throw new Error("YOUTUBE_MEDIA_SIZE_INVALID");
    const mimeType = request.mediaMimeType || mediaResponse.headers.get("content-type") || "video/mp4";

    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authorized.token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(bytes.length),
          "X-Upload-Content-Type": mimeType,
        },
        body: JSON.stringify({
          snippet: {
            title: request.title,
            description: request.caption,
            categoryId: String(request.options?.categoryId ?? "22"),
            tags: Array.isArray(request.options?.tags) ? request.options?.tags : undefined,
          },
          status: {
            privacyStatus: audited ? requestedPrivacy : "private",
            selfDeclaredMadeForKids: request.options?.madeForKids === true,
          },
        }),
        cache: "no-store",
      },
    );
    if (!initResponse.ok) throw new Error(`YOUTUBE_UPLOAD_INIT_${initResponse.status}`);
    const uploadUrl = initResponse.headers.get("location");
    if (!uploadUrl?.startsWith("https://www.googleapis.com/")) throw new Error("YOUTUBE_UPLOAD_LOCATION_INVALID");
    const uploaded = await youtubeJson<{ id?: string; status?: { uploadStatus?: string } }>(
      uploadUrl,
      authorized.token,
      {
        method: "PUT",
        headers: { "Content-Type": mimeType, "Content-Length": String(bytes.length) },
        body: bytes,
      },
    );
    if (!uploaded.id) throw new Error("YOUTUBE_VIDEO_ID_MISSING");
    return { state: "processing", providerPublishId: uploaded.id };
  },

  async getPublishStatus(connection, providerPublishId): Promise<SocialPublishStatus> {
    const authorized = await ensureYouTubeAccess(connection);
    const result = await youtubeJson<{
      items?: Array<{ id?: string; status?: { uploadStatus?: string; rejectionReason?: string; failureReason?: string } }>;
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(providerPublishId)}`,
      authorized.token,
    );
    const video = result.items?.[0];
    if (!video?.id) return { state: "failed", errorCode: "YOUTUBE_VIDEO_NOT_FOUND" };
    if (video.status?.uploadStatus === "uploaded" || video.status?.uploadStatus === "processed") {
      return { state: "published", providerPostId: video.id };
    }
    if (video.status?.uploadStatus === "failed" || video.status?.uploadStatus === "rejected") {
      return {
        state: "failed",
        errorCode: `YOUTUBE_${String(video.status.rejectionReason ?? video.status.failureReason ?? "UPLOAD_FAILED").replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}`,
      };
    }
    return { state: "processing" };
  },
};
