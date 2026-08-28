import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifyMetaClientMediaSignature } from "@/lib/meta/creative";
import { isUuid } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Job = { id: string; account_id: string | null; source_asset_id: string | null; status: string };
type Asset = { id: string; account_id: string; storage_path: string; mime_type: string; rights_confirmed: boolean; archived_at: string | null };

function storageAdmin() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("Storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const signature = new URL(request.url).searchParams.get("sig") ?? "";
    if (!isUuid(jobId) || !verifyMetaClientMediaSignature(jobId, signature)) return new NextResponse("Not found", { status: 404 });
    const jobs = await supabaseServiceRoleRequest<Job[]>(`/rest/v1/wovo_meta_publish_jobs?select=id,account_id,source_asset_id,status&id=eq.${encodeURIComponent(jobId)}&owner_scope=eq.false&status=in.(approved,queued,publishing,published)&limit=1`);
    const job = jobs?.[0];
    if (!job?.account_id || !job.source_asset_id) return new NextResponse("Not found", { status: 404 });
    const assets = await supabaseServiceRoleRequest<Asset[]>(`/rest/v1/wovo_portal_assets?select=id,account_id,storage_path,mime_type,rights_confirmed,archived_at&id=eq.${encodeURIComponent(job.source_asset_id)}&account_id=eq.${encodeURIComponent(job.account_id)}&rights_confirmed=eq.true&archived_at=is.null&limit=1`);
    const asset = assets?.[0];
    if (!asset || (!asset.mime_type.startsWith("image/") && !asset.mime_type.startsWith("video/"))) return new NextResponse("Not found", { status: 404 });
    const { data, error } = await storageAdmin().storage.from("wovo-portal-assets").createSignedUrl(asset.storage_path, 300);
    if (error || !data?.signedUrl) throw new Error("Unable to authorize media.");
    const response = NextResponse.redirect(data.signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse("Media unavailable", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
