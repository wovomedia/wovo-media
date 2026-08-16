import { createElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { verifyMetaCreativeSignature } from "@/lib/meta/creative";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreativeJob = {
  id: string;
  owner_scope: boolean;
  status: string;
  creative_kicker: string | null;
  creative_headline: string | null;
  creative_cta: string | null;
};

function node(type: string, props: Record<string, unknown>, ...children: ReactNode[]) {
  return createElement(type, props, ...children);
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const signature = new URL(request.url).searchParams.get("signature") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !verifyMetaCreativeSignature(jobId, signature)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const rows = await supabaseServiceRoleRequest<CreativeJob[]>(
    `/rest/v1/wovo_meta_publish_jobs?select=id,owner_scope,status,creative_kicker,creative_headline,creative_cta&id=eq.${encodeURIComponent(jobId)}&owner_scope=eq.true&status=in.(approved,queued,publishing,published)&limit=1`,
  ).catch(() => []);
  const job = rows?.[0];
  if (!job?.creative_kicker || !job.creative_headline || !job.creative_cta) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const mark = node("div", { style: { display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800, letterSpacing: "0.15em" } },
    node("div", { style: { display: "flex", width: 54, height: 54, borderRadius: 18, background: "#f05a3a", alignItems: "center", justifyContent: "center", color: "#191714", fontSize: 31, letterSpacing: 0 } }, "W"),
    node("div", { style: { display: "flex" } }, "WOVO MEDIA"),
  );
  const art = node("div", {
    style: {
      width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "76px 76px 70px", color: "#191714", background: "#f5efe5", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden",
    },
  },
  node("div", { style: { position: "absolute", width: 600, height: 600, borderRadius: 999, background: "#f05a3a", right: -270, top: -260, opacity: 0.95 } }),
  node("div", { style: { position: "absolute", width: 360, height: 360, borderRadius: 999, border: "3px solid #191714", right: -110, top: 190, opacity: 0.18 } }),
  node("div", { style: { display: "flex", position: "relative" } }, mark),
  node("div", { style: { display: "flex", flexDirection: "column", position: "relative", maxWidth: 900 } },
    node("div", { style: { display: "flex", fontSize: 25, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#c83f26", marginBottom: 30 } }, job.creative_kicker),
    node("div", { style: { display: "flex", fontFamily: "Georgia, serif", fontSize: 78, lineHeight: 1.02, letterSpacing: "-0.045em", maxWidth: 940 } }, job.creative_headline),
  ),
  node("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", borderTop: "2px solid rgba(25,23,20,.18)", paddingTop: 32 } },
    node("div", { style: { display: "flex", fontSize: 25, fontWeight: 700 } }, job.creative_cta),
    node("div", { style: { display: "flex", fontSize: 22, fontWeight: 800, color: "#c83f26" } }, "WOVOMEDIA.COM"),
  ));

  return new ImageResponse(art, {
    width: 1080,
    height: 1350,
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
