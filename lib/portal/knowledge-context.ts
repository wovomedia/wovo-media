import "server-only";

import { supabaseServiceRoleRequest } from "@/lib/supabase/server";
import type { PortalKnowledgeNote, PortalKnowledgeNoteVersion } from "@/lib/portal/types";

export type ApprovedKnowledgeFact = {
  noteId: string;
  title: string;
  guidanceKind: PortalKnowledgeNoteVersion["guidance_kind"];
  content: string;
  sourceUrl: string | null;
  sourceDate: string | null;
};

/**
 * The only knowledge loader AI routes should use. It selects the explicitly
 * approved version IDs for one account; drafts/current unapproved versions are
 * never returned and an account ID is present in every filter.
 */
export async function loadApprovedKnowledgeContext(
  accountId: string,
  requestedNoteIds?: string[],
): Promise<ApprovedKnowledgeFact[]> {
  const requestedFilter = requestedNoteIds?.length
    ? `&id=in.(${requestedNoteIds.map(encodeURIComponent).join(",")})`
    : "";
  const notes = await supabaseServiceRoleRequest<PortalKnowledgeNote[]>(
    `/rest/v1/wovo_knowledge_notes?select=id,title,approved_version_id,account_id,status&account_id=eq.${encodeURIComponent(accountId)}&status=eq.approved&approved_version_id=not.is.null${requestedFilter}&limit=200`,
  ).catch(() => []);
  const approvedIds = (notes ?? []).map((note) => note.approved_version_id).filter((id): id is string => Boolean(id));
  if (!approvedIds.length) return [];
  const versions = await supabaseServiceRoleRequest<PortalKnowledgeNoteVersion[]>(
    `/rest/v1/wovo_knowledge_note_versions?select=id,note_id,account_id,title,body,source_url,source_date,guidance_kind&id=in.(${approvedIds.map(encodeURIComponent).join(",")})&account_id=eq.${encodeURIComponent(accountId)}&limit=200`,
  ).catch(() => []);
  const approvedByNote = new Map((notes ?? []).map((note) => [note.id, note.approved_version_id]));
  return (versions ?? [])
    .filter((version) => approvedByNote.get(version.note_id) === version.id)
    .map((version) => ({
      noteId: version.note_id,
      title: version.title,
      guidanceKind: version.guidance_kind,
      content: version.body,
      sourceUrl: version.source_url,
      sourceDate: version.source_date,
    }));
}
export function formatApprovedKnowledgeForPrompt(facts: ApprovedKnowledgeFact[]): string {
  if (!facts.length) return "No approved WOVO Notes were supplied. Do not state business-specific facts; ask the owner for approved sources.";
  return facts.map((fact, index) => {
    const source = fact.sourceUrl || fact.sourceDate
      ? `Source: ${fact.sourceUrl ?? "owner record"}${fact.sourceDate ? ` (dated ${fact.sourceDate})` : ""}`
      : "Source: owner-approved WOVO Note (no external source URL recorded)";
    return `[Approved note ${index + 1}: ${fact.title}; ${fact.guidanceKind}]\n${fact.content}\n${source}`;
  }).join("\n\n");
}
