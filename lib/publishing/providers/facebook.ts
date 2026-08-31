import "server-only";

import { metaGraph } from "@/lib/meta/integration";
import { metaContext, publishFacebookReel, verifyMetaDestination } from "@/lib/publishing/providers/meta-shared";
import type { PublisherAdapter } from "@/lib/publishing/types";

export const facebookPublisher: PublisherAdapter = {
  provider: "facebook",
  verifyConnection: (connection) => verifyMetaDestination(connection, "facebook"),
  refreshAuthorization: async (connection) => connection,
  async validatePost(request) {
    if (request.provider !== "facebook") throw new Error("FACEBOOK_PROVIDER_MISMATCH");
    if ((request.publishType === "image" || request.publishType === "video") && !request.mediaUrl) throw new Error("FACEBOOK_MEDIA_REQUIRED");
    if (!request.caption.trim() && request.publishType === "text") throw new Error("FACEBOOK_MESSAGE_REQUIRED");
  },
  async publishPost(request, connection) {
    await this.validatePost(request);
    const { legacy, token } = await metaContext(connection);
    if (request.publishType === "video") {
      const id = await publishFacebookReel(legacy.page_id, request.mediaUrl!, request.caption, token);
      return { state: "published", providerPostId: id };
    }
    const path = request.publishType === "image" ? `${legacy.page_id}/photos` : `${legacy.page_id}/feed`;
    const body = new URLSearchParams({ message: request.caption, access_token: token });
    if (request.mediaUrl) body.set("url", request.mediaUrl);
    const result = await metaGraph<{ id?: string }>(path, token, { method: "POST", body });
    if (!result.id) throw new Error("META_PROVIDER_POST_ID_MISSING");
    return { state: "published", providerPostId: result.id };
  },
  async getPublishStatus(_connection, providerPublishId) {
    return { state: "published", providerPostId: providerPublishId };
  },
};
