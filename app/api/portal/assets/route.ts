import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, isUuid, PortalHttpError, requiredString, requirePortalContext } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;

function adminStorage() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("Supabase Storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function validateMeta(type: unknown, size: unknown) {
  if (typeof type !== "string" || !TYPES.has(type)) throw new PortalHttpError(400, "Upload a JPG, PNG, WebP, PDF, MP4, WebM, or QuickTime file.");
  const bytes = Number(size);
  const limit = type.startsWith("video/") ? VIDEO_MAX : IMAGE_MAX;
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > limit) {
    throw new PortalHttpError(400, type.startsWith("video/") ? "Videos must be 100 MB or smaller." : "Images and documents must be 10 MB or smaller.");
  }
  return { type, bytes };
}

function extension(type: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" }[type] ?? "bin";
}

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const accountId = body.accountId;
    if (!isUuid(accountId)) throw new PortalHttpError(400, "Invalid account.");
    await assertPortalAccountAccess(context, accountId);
    if (body.rightsConfirmed !== true || body.peopleConsentConfirmed !== true) {
      throw new PortalHttpError(400, "Confirm asset rights and consent for every person depicted.");
    }
    const { type, bytes } = validateMeta(body.mimeType, body.sizeBytes);
    const fileName = requiredString(body.fileName, "File name", 180);
    const kind = requiredString(body.assetKind ?? "brand", "Asset type", 30);
    // "food" is distinct from "menu": a menu is the document, food assets are
    // photos of actual dishes. Food-service businesses are required to supply
    // the latter before WOVO will generate marketing for them.
    if (!["brand", "food", "property", "menu", "project", "reference"].includes(kind)) throw new PortalHttpError(400, "Invalid asset type.");
    const storage = adminStorage();

    if (body.action === "prepare") {
      const path = `${accountId}/${randomUUID()}.${extension(type)}`;
      const { data, error } = await storage.storage.from("wovo-portal-assets").createSignedUploadUrl(path);
      if (error || !data?.token) throw new Error(error?.message || "Unable to prepare private upload.");
      return NextResponse.json({ bucket: "wovo-portal-assets", path, token: data.token });
    }

    if (body.action === "finalize") {
      const path = requiredString(body.path, "Storage path", 240);
      if (!path.startsWith(`${accountId}/`) || path.includes("..")) throw new PortalHttpError(400, "Invalid storage path.");
      const leaf = path.slice(accountId.length + 1);
      const { data: files, error } = await storage.storage.from("wovo-portal-assets").list(accountId, { search: leaf, limit: 2 });
      if (error) throw new Error(error.message);
      const stored = files?.find((file) => file.name === leaf);
      const metadata = stored?.metadata as { size?: number; mimetype?: string } | null | undefined;
      if (!stored || Number(metadata?.size) !== bytes || metadata?.mimetype !== type) {
        await storage.storage.from("wovo-portal-assets").remove([path]).catch(() => null);
        throw new PortalHttpError(400, "Uploaded file metadata did not match the authorized upload.");
      }
      const rows = await supabaseServiceRoleRequest<Array<Record<string, unknown>>>("/rest/v1/wovo_portal_assets", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          account_id: accountId,
          uploaded_by: context.user.id,
          file_name: fileName,
          storage_path: path,
          mime_type: type,
          size_bytes: bytes,
          asset_kind: kind,
          rights_confirmed: true,
          people_consent_confirmed: true,
        }),
      });
      return NextResponse.json({ asset: rows?.[0] }, { status: 201 });
    }
    throw new PortalHttpError(400, "Unknown asset action.");
  } catch (error) {
    if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Asset upload failed.";
    if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Portal asset request failed", error);
    return NextResponse.json({ error: "The private asset upload could not be completed." }, { status: 500 });
  }
}
