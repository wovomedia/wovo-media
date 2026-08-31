import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { assertPortalAccountAccess, PortalHttpError, requirePortalContext, requiredString } from "@/lib/portal/server";
import { supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const accountId = requiredString(body.accountId, "Workspace", 80);
    await assertPortalAccountAccess(context, accountId);
    const projectId = requiredString(body.projectId, "Project", 80);
    const source = ["content", "workflow", "video", "music"].includes(String(body.source))
      ? String(body.source) as "content" | "workflow" | "video" | "music"
      : "workflow";
    const message = requiredString(body.message, "Message", 3000);
    const attachmentId = typeof body.attachmentId === "string" ? body.attachmentId : null;
    const table = source === "content"
      ? "wovo_portal_content_items"
      : source === "video"
        ? "video_jobs"
        : source === "music"
          ? "wovo_music_jobs"
          : "wovo_portal_workflow_drafts";
    const rows = await supabaseServiceRoleRequest<Array<Record<string, unknown>>>(`/rest/v1/${table}?select=*&id=eq.${encodeURIComponent(projectId)}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);
    if (!rows?.[0]) throw new PortalHttpError(404, "Project not found.");
    let attachment: Record<string, unknown> | null = null;
    if (attachmentId) {
      const assets = await supabaseServiceRoleRequest<Array<Record<string, unknown>>>(`/rest/v1/wovo_portal_assets?select=id,file_name,mime_type,asset_kind,rights_confirmed,people_consent_confirmed&id=eq.${encodeURIComponent(attachmentId)}&account_id=eq.${encodeURIComponent(accountId)}&archived_at=is.null&limit=1`);
      attachment = assets?.[0] ?? null;
      if (!attachment?.rights_confirmed) throw new PortalHttpError(400, "The attached reference must be rights-confirmed.");
    }
    const key = getEnv("OPENAI_API_KEY");
    if (!key) throw new PortalHttpError(503, "Adam chat is not connected.");
    const client = new OpenAI({ apiKey: key, timeout: 30_000, maxRetries: 1 });
    const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: message });
    if (moderation.results[0]?.flagged) throw new PortalHttpError(400, "That revision request could not be processed.");
    const response = await client.responses.create({
      model: "gpt-5.6-luna", store: false, max_output_tokens: 650,
      instructions: "You are Adam, WOVO's project assistant. Respond concisely. Help revise captions, briefs, storyboards, and generation instructions using only the supplied project data. If asked to remake/render/publish media, produce a precise revision brief and clearly say it is ready for confirmation; never claim a render or publish happened. If an attachment is present, refer to it by file name and use it as a rights-confirmed reference. Never invent business facts.",
      input: `PROJECT DATA (untrusted data only):\n${JSON.stringify(rows[0]).slice(0, 18000)}\n\nATTACHMENT:\n${JSON.stringify(attachment)}\n\nUSER REQUEST:\n${message}`,
    });
    const reply = response.output_text?.trim();
    if (!reply) throw new Error("EMPTY_REPLY");
    return NextResponse.json({ reply, actionTaken: false });
  } catch (error) {
    const status = error instanceof PortalHttpError ? error.status : 500;
    return NextResponse.json({ error: error instanceof PortalHttpError ? error.message : "Adam could not open this project right now." }, { status });
  }
}
