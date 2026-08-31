export const SOCIAL_PROVIDERS = ["facebook", "instagram", "tiktok", "youtube"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_CONNECTION_STATUSES = [
  "connected",
  "publishing_ready",
  "action_required",
  "expired",
  "disconnected",
  "under_review",
  "test_mode",
  "error",
] as const;
export type SocialConnectionStatus = (typeof SOCIAL_CONNECTION_STATUSES)[number];

export type SocialConnectionRecord = {
  id: string;
  workspace_id: string | null;
  owner_scope: boolean;
  provider: SocialProvider;
  provider_user_id: string | null;
  provider_account_id: string;
  provider_account_name: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  last_verified_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata_json: Record<string, unknown>;
  disconnected_at: string | null;
};

export type SocialPublishType = "text" | "image" | "video";

export type SocialPublishRequest = {
  connectionId: string;
  provider: SocialProvider;
  publishType: SocialPublishType;
  title?: string;
  caption: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  privacyStatus?: string;
  options?: Record<string, unknown>;
};

export type SocialPublishResult = {
  state: "processing" | "published";
  providerPublishId?: string;
  providerPostId?: string;
};

export type SocialPublishStatus = {
  state: "processing" | "published" | "failed";
  providerPostId?: string;
  errorCode?: string;
};

export type ConnectionVerification = {
  ok: boolean;
  status: SocialConnectionStatus;
  accountId?: string;
  accountName?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  errorCode?: string;
  userMessage?: string;
};

export interface PublisherAdapter {
  readonly provider: SocialProvider;
  verifyConnection(connection: SocialConnectionRecord): Promise<ConnectionVerification>;
  validatePost(request: SocialPublishRequest): Promise<void>;
  publishPost(request: SocialPublishRequest, connection: SocialConnectionRecord): Promise<SocialPublishResult>;
  getPublishStatus(connection: SocialConnectionRecord, providerPublishId: string): Promise<SocialPublishStatus>;
  refreshAuthorization(connection: SocialConnectionRecord): Promise<SocialConnectionRecord>;
}

export function normalizeProviderErrorCode(error: unknown, fallback = "PROVIDER_REQUEST_FAILED") {
  const raw = error instanceof Error ? error.message : fallback;
  return (raw.split(":")[0] || fallback).replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80);
}
