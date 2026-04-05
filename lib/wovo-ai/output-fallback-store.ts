import { randomUUID } from "node:crypto";
import { getAuthAdminUserById, updateAuthUserById } from "@/lib/supabase/server";

const OUTPUTS_METADATA_KEY = "wovo_saved_outputs";
const MAX_OUTPUTS_PER_USER = 300;

type OutputPayload = Record<string, unknown>;

export type FallbackOutputRecord = {
  id: string;
  input: OutputPayload;
  output: OutputPayload;
  created_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseOutputRecord(value: unknown): FallbackOutputRecord | null {
  const row = asRecord(value);
  const id = asString(row.id).trim().toLowerCase();
  const createdAt = asString(row.created_at).trim();
  if (!isUuid(id) || !createdAt) return null;
  return {
    id,
    input: asRecord(row.input),
    output: asRecord(row.output),
    created_at: createdAt,
  };
}

function uniqueById(rows: FallbackOutputRecord[]): FallbackOutputRecord[] {
  const seen = new Set<string>();
  const result: FallbackOutputRecord[] = [];
  for (const row of rows) {
    const normalizedId = row.id.trim().toLowerCase();
    if (!normalizedId || seen.has(normalizedId)) continue;
    seen.add(normalizedId);
    result.push({ ...row, id: normalizedId });
  }
  return result;
}

function sortByCreatedAtDesc(rows: FallbackOutputRecord[]): FallbackOutputRecord[] {
  return rows.sort((left, right) => {
    const leftTs = Date.parse(left.created_at);
    const rightTs = Date.parse(right.created_at);
    const leftSafe = Number.isFinite(leftTs) ? leftTs : 0;
    const rightSafe = Number.isFinite(rightTs) ? rightTs : 0;
    if (leftSafe !== rightSafe) return rightSafe - leftSafe;
    return right.id.localeCompare(left.id);
  });
}

function extractOutputListFromAppMetadata(appMetadata: Record<string, unknown>): FallbackOutputRecord[] {
  const raw = appMetadata[OUTPUTS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  return uniqueById(
    raw.map((item) => parseOutputRecord(item)).filter((item): item is FallbackOutputRecord => Boolean(item)),
  );
}

async function writeOutputListToAppMetadata(userId: string, rows: FallbackOutputRecord[]): Promise<void> {
  const authUser = await getAuthAdminUserById(userId).catch(() => null);
  if (!authUser?.id) return;
  const appMetadata = asRecord(authUser.app_metadata);
  await updateAuthUserById(authUser.id, {
    app_metadata: {
      ...appMetadata,
      [OUTPUTS_METADATA_KEY]: rows.slice(0, MAX_OUTPUTS_PER_USER),
    },
  }).catch(() => undefined);
}

export function isMissingGenerationsTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("generations") &&
    (message.includes("could not find the table") ||
      message.includes("relation") ||
      message.includes("does not exist") ||
      message.includes("schema cache"))
  );
}

export async function listFallbackOutputsForUser(
  userId: string,
  limit = 20,
): Promise<FallbackOutputRecord[]> {
  const authUser = await getAuthAdminUserById(userId).catch(() => null);
  const appMetadata = asRecord(authUser?.app_metadata);
  const rows = extractOutputListFromAppMetadata(appMetadata);
  return sortByCreatedAtDesc(rows).slice(0, Math.max(1, Math.min(limit, 300)));
}

export async function getFallbackOutputForUser(
  userId: string,
  outputId: string,
): Promise<FallbackOutputRecord | null> {
  const rows = await listFallbackOutputsForUser(userId, 300);
  const normalizedId = outputId.trim().toLowerCase();
  return rows.find((item) => item.id === normalizedId) ?? null;
}

export async function insertFallbackOutputForUser(input: {
  userId: string;
  input: OutputPayload;
  output: OutputPayload;
}): Promise<FallbackOutputRecord> {
  const nowIso = new Date().toISOString();
  const nextRow: FallbackOutputRecord = {
    id: randomUUID(),
    input: asRecord(input.input),
    output: asRecord(input.output),
    created_at: nowIso,
  };
  const current = await listFallbackOutputsForUser(input.userId, 300);
  const merged = uniqueById([nextRow, ...current]);
  await writeOutputListToAppMetadata(input.userId, merged);
  return nextRow;
}

export async function updateFallbackOutputForUser(input: {
  userId: string;
  outputId: string;
  output: OutputPayload;
}): Promise<FallbackOutputRecord | null> {
  const normalizedId = input.outputId.trim().toLowerCase();
  const current = await listFallbackOutputsForUser(input.userId, 300);
  let updatedRow: FallbackOutputRecord | null = null;

  const next = current.map((row) => {
    if (row.id !== normalizedId) return row;
    updatedRow = {
      ...row,
      output: asRecord(input.output),
    };
    return updatedRow;
  });

  if (!updatedRow) return null;
  await writeOutputListToAppMetadata(input.userId, next);
  return updatedRow;
}

export async function deleteFallbackOutputForUser(input: {
  userId: string;
  outputId: string;
}): Promise<boolean> {
  const normalizedId = input.outputId.trim().toLowerCase();
  const current = await listFallbackOutputsForUser(input.userId, 300);
  const next = current.filter((row) => row.id !== normalizedId);
  if (next.length === current.length) return false;
  await writeOutputListToAppMetadata(input.userId, next);
  return true;
}

