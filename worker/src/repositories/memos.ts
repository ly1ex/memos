import { buildMemoPayload } from "../domain/memo-payload";
import { HttpError } from "../http/errors";
import { decodeCreatedCursor, pageFromLimit, type CursorPage } from "./cursor";
import { nowTs } from "../utils/time";
import { createUid } from "../utils/uid";

export type MemoVisibility = "PUBLIC" | "PROTECTED" | "PRIVATE";
export type MemoRowStatus = "NORMAL" | "ARCHIVED";

export interface Memo {
  id: number;
  uid: string;
  creatorId: number;
  creatorUsername?: string;
  content: string;
  visibility: MemoVisibility;
  rowStatus: MemoRowStatus;
  pinned: boolean;
  payload: unknown;
  createdTs: number;
  updatedTs: number;
}

interface MemoRow {
  id: number;
  uid: string;
  creatorId: number;
  creatorUsername: string | null;
  content: string;
  visibility: MemoVisibility;
  rowStatus: MemoRowStatus;
  pinned: number;
  payloadJson: string;
  createdTs: number;
  updatedTs: number;
}

export interface CreateMemoInput {
  uid?: string;
  creatorId: number;
  content: string;
  visibility: MemoVisibility;
}

export interface UpdateMemoInput {
  content?: string;
  visibility?: MemoVisibility;
  pinned?: boolean;
}

export interface ListMemosInput {
  creatorId: number;
  pageSize: number;
  cursor?: string | null;
}

export interface ListVisibleMemosInput {
  viewerId?: number;
  pageSize: number;
  cursor?: string | null;
}

export interface ListPublicMemosInput {
  creatorId?: number;
  limit: number;
}

const memoSelect = `
  SELECT
    id,
    uid,
    creator_id AS creatorId,
    (SELECT username FROM "user" WHERE "user".id = memo.creator_id) AS creatorUsername,
    content,
    visibility,
    row_status AS rowStatus,
    pinned,
    payload_json AS payloadJson,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM memo
`;

export async function createMemo(db: D1Database, input: CreateMemoInput): Promise<Memo> {
  validateMemoContent(input.content);
  const now = nowTs();
  const uid = validateMemoUid(input.uid) ?? createUid("memo");
  const payloadJson = JSON.stringify(buildMemoPayload(input.content));
  const row = await db
    .prepare(
      `
        INSERT INTO memo (
          uid,
          creator_id,
          content,
          visibility,
          row_status,
          pinned,
          payload_json,
          created_ts,
          updated_ts
        ) VALUES (?, ?, ?, ?, 'NORMAL', 0, ?, ?, ?)
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          (SELECT username FROM "user" WHERE "user".id = creator_id) AS creatorUsername,
          content,
          visibility,
          row_status AS rowStatus,
          pinned,
          payload_json AS payloadJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(uid, input.creatorId, input.content, input.visibility, payloadJson, now, now)
    .first<MemoRow>();

  if (!row) {
    throw new Error("Failed to create memo");
  }
  return toMemo(row);
}

export async function listMemos(db: D1Database, input: ListMemosInput): Promise<CursorPage<Memo>> {
  const cursor = decodeCreatedCursor(input.cursor ?? null);
  const where = ["creator_id = ?", "row_status = 'NORMAL'"];
  const bindings: unknown[] = [input.creatorId];

  if (cursor) {
    where.push("(created_ts < ? OR (created_ts = ? AND id < ?))");
    bindings.push(cursor.createdTs, cursor.createdTs, cursor.id);
  }

  bindings.push(input.pageSize + 1);
  const result = await db
    .prepare(
      `
        ${memoSelect}
        WHERE ${where.join(" AND ")}
        ORDER BY created_ts DESC, id DESC
        LIMIT ?
      `
    )
    .bind(...bindings)
    .all<MemoRow>();

  return pageFromLimit((result.results ?? []).map(toMemo), input.pageSize);
}

export async function listVisibleMemos(db: D1Database, input: ListVisibleMemosInput): Promise<CursorPage<Memo>> {
  const cursor = decodeCreatedCursor(input.cursor ?? null);
  const where = ["row_status = 'NORMAL'"];
  const bindings: unknown[] = [];

  if (input.viewerId === undefined) {
    where.push("visibility = 'PUBLIC'");
  } else {
    where.push("(creator_id = ? OR visibility IN ('PUBLIC', 'PROTECTED'))");
    bindings.push(input.viewerId);
  }

  if (cursor) {
    where.push("(created_ts < ? OR (created_ts = ? AND id < ?))");
    bindings.push(cursor.createdTs, cursor.createdTs, cursor.id);
  }

  bindings.push(input.pageSize + 1);
  const result = await db
    .prepare(
      `
        ${memoSelect}
        WHERE ${where.join(" AND ")}
        ORDER BY created_ts DESC, id DESC
        LIMIT ?
      `
    )
    .bind(...bindings)
    .all<MemoRow>();

  return pageFromLimit((result.results ?? []).map(toMemo), input.pageSize);
}

export async function listPublicMemos(db: D1Database, input: ListPublicMemosInput): Promise<Memo[]> {
  const where = ["visibility = 'PUBLIC'", "row_status = 'NORMAL'"];
  const bindings: unknown[] = [];

  if (input.creatorId !== undefined) {
    where.push("creator_id = ?");
    bindings.push(input.creatorId);
  }

  bindings.push(Math.min(input.limit, 100));
  const result = await db
    .prepare(
      `
        ${memoSelect}
        WHERE ${where.join(" AND ")}
        ORDER BY created_ts DESC, id DESC
        LIMIT ?
      `
    )
    .bind(...bindings)
    .all<MemoRow>();

  return (result.results ?? []).map(toMemo);
}

export async function getMemoById(db: D1Database, id: number): Promise<Memo | null> {
  const row = await db.prepare(`${memoSelect} WHERE id = ? LIMIT 1`).bind(id).first<MemoRow>();
  return row ? toMemo(row) : null;
}

export async function getMemoByUid(db: D1Database, uid: string): Promise<Memo | null> {
  const row = await db.prepare(`${memoSelect} WHERE uid = ? LIMIT 1`).bind(uid).first<MemoRow>();
  return row ? toMemo(row) : null;
}

export async function updateMemo(db: D1Database, id: number, input: UpdateMemoInput): Promise<Memo | null> {
  const assignments: string[] = [];
  const bindings: unknown[] = [];

  if (input.content !== undefined) {
    validateMemoContent(input.content);
    assignments.push("content = ?");
    bindings.push(input.content);
    assignments.push("payload_json = ?");
    bindings.push(JSON.stringify(buildMemoPayload(input.content)));
  }

  if (input.visibility !== undefined) {
    assignments.push("visibility = ?");
    bindings.push(input.visibility);
  }

  if (input.pinned !== undefined) {
    assignments.push("pinned = ?");
    bindings.push(input.pinned ? 1 : 0);
  }

  if (assignments.length === 0) {
    return getMemoById(db, id);
  }

  assignments.push("updated_ts = ?");
  bindings.push(nowTs(), id);

  const row = await db
    .prepare(
      `
        UPDATE memo
        SET ${assignments.join(", ")}
        WHERE id = ?
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          (SELECT username FROM "user" WHERE "user".id = creator_id) AS creatorUsername,
          content,
          visibility,
          row_status AS rowStatus,
          pinned,
          payload_json AS payloadJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(...bindings)
    .first<MemoRow>();

  return row ? toMemo(row) : null;
}

export async function archiveMemo(db: D1Database, id: number): Promise<Memo | null> {
  const row = await db
    .prepare(
      `
        UPDATE memo
        SET row_status = 'ARCHIVED', updated_ts = ?
        WHERE id = ?
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          (SELECT username FROM "user" WHERE "user".id = creator_id) AS creatorUsername,
          content,
          visibility,
          row_status AS rowStatus,
          pinned,
          payload_json AS payloadJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(nowTs(), id)
    .first<MemoRow>();

  return row ? toMemo(row) : null;
}

export function parseMemoVisibility(value: unknown, fallback: MemoVisibility): MemoVisibility {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (value === "PUBLIC" || value === "PROTECTED" || value === "PRIVATE") {
    return value;
  }
  throw new HttpError(400, "bad_request", "Invalid memo visibility");
}

function validateMemoContent(content: string): void {
  if (content.length > 1_000_000) {
    throw new HttpError(400, "bad_request", "Memo content is too large");
  }
}

function validateMemoUid(uid: string | undefined): string | undefined {
  if (uid === undefined || uid === "") {
    return undefined;
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) {
    throw new HttpError(400, "bad_request", "Invalid memo id");
  }
  return uid;
}

function toMemo(row: MemoRow): Memo {
  return {
    id: row.id,
    uid: row.uid,
    creatorId: row.creatorId,
    creatorUsername: row.creatorUsername ?? undefined,
    content: row.content,
    visibility: row.visibility,
    rowStatus: row.rowStatus,
    pinned: row.pinned === 1,
    payload: parsePayload(row.payloadJson),
    createdTs: row.createdTs,
    updatedTs: row.updatedTs
  };
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}
