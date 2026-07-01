import { decodeCreatedCursor, pageFromLimit, type CursorPage } from "./cursor";
import type { Memo } from "./memos";
import { nowTs } from "../utils/time";

export type MemoRelationType = "COMMENT";

export interface MemoRelation {
  id: number;
  memoId: number;
  relatedMemoId: number;
  type: string;
  createdTs: number;
}

interface MemoRelationRow {
  id: number;
  memoId: number;
  relatedMemoId: number;
  type: string;
  createdTs: number;
}

interface MemoWithRelationRow {
  id: number;
  uid: string;
  creatorId: number;
  content: string;
  visibility: "PUBLIC" | "PROTECTED" | "PRIVATE";
  rowStatus: "NORMAL" | "ARCHIVED";
  pinned: number;
  payloadJson: string;
  createdTs: number;
  updatedTs: number;
}

export async function createMemoRelation(
  db: D1Database,
  input: { memoId: number; relatedMemoId: number; type: MemoRelationType }
): Promise<void> {
  await db
    .prepare(
      `
        INSERT OR IGNORE INTO memo_relation (memo_id, related_memo_id, type, created_ts)
        VALUES (?, ?, ?, ?)
      `
    )
    .bind(input.memoId, input.relatedMemoId, input.type, nowTs())
    .run();
}

export async function listMemoRelations(db: D1Database, memoId: number): Promise<MemoRelation[]> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          memo_id AS memoId,
          related_memo_id AS relatedMemoId,
          type,
          created_ts AS createdTs
        FROM memo_relation
        WHERE memo_id = ?
        ORDER BY created_ts ASC, id ASC
      `
    )
    .bind(memoId)
    .all<MemoRelationRow>();
  return result.results ?? [];
}

export async function setMemoRelations(
  db: D1Database,
  input: { memoId: number; relations: Array<{ relatedMemoId: number; type: string }> }
): Promise<MemoRelation[]> {
  if (input.relations.length > 50) {
    throw new Error("Too many relations");
  }

  const now = nowTs();
  await db.prepare("DELETE FROM memo_relation WHERE memo_id = ? AND type != 'COMMENT'").bind(input.memoId).run();

  for (const relation of input.relations) {
    if (relation.type === "COMMENT") {
      continue;
    }
    await db
      .prepare(
        `
          INSERT OR IGNORE INTO memo_relation (memo_id, related_memo_id, type, created_ts)
          VALUES (?, ?, ?, ?)
        `
      )
      .bind(input.memoId, relation.relatedMemoId, relation.type, now)
      .run();
  }

  return listMemoRelations(db, input.memoId);
}

export async function listMemoComments(
  db: D1Database,
  input: { memoId: number; pageSize: number; cursor?: string | null }
): Promise<CursorPage<Memo>> {
  const cursor = decodeCreatedCursor(input.cursor ?? null);
  const where = ["relation.memo_id = ?", "relation.type = 'COMMENT'", "comment.row_status = 'NORMAL'"];
  const bindings: unknown[] = [input.memoId];

  if (cursor) {
    where.push("(comment.created_ts < ? OR (comment.created_ts = ? AND comment.id < ?))");
    bindings.push(cursor.createdTs, cursor.createdTs, cursor.id);
  }

  bindings.push(input.pageSize + 1);
  const result = await db
    .prepare(
      `
        SELECT
          comment.id,
          comment.uid,
          comment.creator_id AS creatorId,
          comment.content,
          comment.visibility,
          comment.row_status AS rowStatus,
          comment.pinned,
          comment.payload_json AS payloadJson,
          comment.created_ts AS createdTs,
          comment.updated_ts AS updatedTs
        FROM memo_relation AS relation
        JOIN memo AS comment ON comment.id = relation.related_memo_id
        WHERE ${where.join(" AND ")}
        ORDER BY comment.created_ts ASC, comment.id ASC
        LIMIT ?
      `
    )
    .bind(...bindings)
    .all<MemoWithRelationRow>();

  return pageFromLimit((result.results ?? []).map(toMemo), input.pageSize);
}

function toMemo(row: MemoWithRelationRow): Memo {
  return {
    id: row.id,
    uid: row.uid,
    creatorId: row.creatorId,
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
