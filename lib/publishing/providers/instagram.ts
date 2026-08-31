import "server-only";

import { metaGraph } from "@/lib/meta/integration";
import { metaContext, verifyMetaDestination, waitForInstagramContainer } from "@/lib/publishing/providers/meta-shared";
import type { PublisherAdapter } from "@/lib/publishing/types";

export const instagramPublisher: PublisherAdapter = {
  provider: "instagram",
  verifyConnection: (connection) => verifyMetaDestination(connection, "instagram"),
  refreshAuthorization: async (connection) => connection,
  async validatePost(request) {
    if (request.provider !== "instagram") throw new Error("INSTAGRAM_PROVIDER_MISMATCH");
    if (request.publishType === "text" || !request.mediaUrl) throw new Error("INSTAGRAM_MEDIA_REQUIRED");
  },
  async publishPost(request, connection) {
    await this.validatePost(request);
    const { legacy, token } = await metaContext(connection);
    if (!legacy.instagram_user_id) throw new Error("META_INSTAGRAM_PROFESSIONAL_ACCOUNT_MISSING");
    const fields = new URLSearchParams({ caption: request.caption, access_token: token });
    if (request.publishType === "video") {
      fields.set("media_type", "REELS");
      fields.set("video_url", request.mediaUrl!);
      fields.set("share_to_feed", "true");
    } else {
      fields.set("image_url", request.mediaUrl!);
    }
    const container = await metaGraph<{ id?: string }>(`${legacy.instagram_user_id}/media`, token, { method: "POST", body: fields });
    if (!container.id) throw new Error("META_CONTAINER_ID_MISSING");
    await waitForInstagramContainer(container.id, token);
    const published = await metaGraph<{ id?: string }>(`${legacy.instagram_user_id}/media_publish`, token, {
      method: "POST",
      body: new URLSearchParams({ creation_id: container.id, access_token: token }),
    });
    if (!published.id) throw new Error("META_PROVIDER_POST_ID_MISSING");
    return { state: "published", providerPostId: published.id };
  },
  async getPublishStatus(_connection, providerPublishId) {
    return { state: "published", providerPostId: providerPublishId };
  },
};
