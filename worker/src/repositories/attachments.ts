import { HttpError } from "../http/errors";
import { decodeCreatedCursor, pageFromLimit, type CursorPage } from "./cursor";
import { nowTs } from "../utils/time";
import { createUid } from "../utils/uid";

export interface Attachment {
  id: number;
  uid: string;
  creatorId: number;
  memoId?: number;
  memoUid?: string;
  filename: string;
  type: string;
  size: number;
  r2Key: string;
  r2Bucket: string;
  sha256: string;
  metadata: unknown;
  createdTs: number;
  updatedTs: number;
}

interface AttachmentRow {
  id: number;
  uid: string;
  creatorId: number;
  memoId: number | null;
  memoUid: string | null;
  filename: string;
  type: string;
  size: number;
  r2Key: string;
  r2Bucket: string;
  sha256: string;
  metadataJson: string;
  createdTs: number;
  updatedTs: number;
}

export interface CreateAttachmentMetadataInput {
  uid?: string;
  creatorId: number;
  memoId?: number;
  filename: string;
  type?: string;
  size?: number;
  r2Key: string;
  r2Bucket?: string;
  sha256?: string;
  metadata?: unknown;
}

export interface ListAttachmentsInput {
  creatorId?: number;
  memoId?: number;
  pageSize: number;
  cursor?: string | null;
}

export interface SetMemoAttachmentsInput {
  memoId: number;
  creatorId: number;
  attachmentIds: number[];
}

export interface UpdateAttachmentMetadataInput {
  id: number;
  creatorId: number;
  filename?: string;
  type?: string;
  metadata?: unknown;
  memoId?: number | null;
}

const attachmentSelect = `
  SELECT
    id,
    uid,
    creator_id AS creatorId,
    memo_id AS memoId,
    (SELECT uid FROM memo WHERE memo.id = attachment.memo_id) AS memoUid,
    filename,
    type,
    size,
    r2_key AS r2Key,
    r2_bucket AS r2Bucket,
    sha256,
    metadata_json AS metadataJson,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM attachment
`;

export async function createAttachmentMetadata(db: D1Database, input: CreateAttachmentMetadataInput): Promise<Attachment> {
  validateAttachmentMetadata(input);
  const now = nowTs();
  const uid = input.uid ?? createUid("att");
  const row = await db
    .prepare(
      `
        INSERT INTO attachment (
          uid,
          creator_id,
          memo_id,
          filename,
          type,
          size,
          r2_key,
          r2_bucket,
          sha256,
          metadata_json,
          created_ts,
          updated_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          memo_id AS memoId,
          (SELECT uid FROM memo WHERE memo.id = memo_id) AS memoUid,
          filename,
          type,
          size,
          r2_key AS r2Key,
          r2_bucket AS r2Bucket,
          sha256,
          metadata_json AS metadataJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(
      uid,
      input.creatorId,
      input.memoId ?? null,
      input.filename,
      input.type ?? "",
      input.size ?? 0,
      input.r2Key,
      input.r2Bucket ?? "",
      input.sha256 ?? "",
      JSON.stringify(input.metadata ?? {}),
      now,
      now
    )
    .first<AttachmentRow>();

  if (!row) {
    throw new Error("Failed to create attachment metadata");
  }
  return toAttachment(row);
}

export async function listAttachments(db: D1Database, input: ListAttachmentsInput): Promise<CursorPage<Attachment>> {
  const cursor = decodeCreatedCursor(input.cursor ?? null);
  const where = ["1 = 1"];
  const bindings: unknown[] = [];

  if (input.creatorId !== undefined) {
    where.push("creator_id = ?");
    bindings.push(input.creatorId);
  }

  if (input.memoId !== undefined) {
    where.push("memo_id = ?");
    bindings.push(input.memoId);
  }

  if (cursor) {
    where.push("(created_ts < ? OR (created_ts = ? AND id < ?))");
    bindings.push(cursor.createdTs, cursor.createdTs, cursor.id);
  }

  bindings.push(input.pageSize + 1);
  const result = await db
    .prepare(
      `
        ${attachmentSelect}
        WHERE ${where.join(" AND ")}
        ORDER BY created_ts DESC, id DESC
        LIMIT ?
      `
    )
    .bind(...bindings)
    .all<AttachmentRow>();

  return pageFromLimit((result.results ?? []).map(toAttachment), input.pageSize);
}

export async function getAttachmentById(db: D1Database, id: number): Promise<Attachment | null> {
  const row = await db.prepare(`${attachmentSelect} WHERE id = ? LIMIT 1`).bind(id).first<AttachmentRow>();
  return row ? toAttachment(row) : null;
}

export async function getAttachmentByUid(db: D1Database, uid: string): Promise<Attachment | null> {
  const row = await db.prepare(`${attachmentSelect} WHERE uid = ? LIMIT 1`).bind(uid).first<AttachmentRow>();
  return row ? toAttachment(row) : null;
}

export async function getAttachmentByIdOrUid(db: D1Database, idOrUid: string): Promise<Attachment | null> {
  if (/^\d+$/.test(idOrUid)) {
    const byId = await getAttachmentById(db, Number(idOrUid));
    if (byId) {
      return byId;
    }
  }
  return getAttachmentByUid(db, idOrUid);
}

export async function setMemoAttachments(db: D1Database, input: SetMemoAttachmentsInput): Promise<Attachment[]> {
  const uniqueAttachmentIds = [...new Set(input.attachmentIds)];
  if (uniqueAttachmentIds.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }

  if (uniqueAttachmentIds.length === 0) {
    await db
      .prepare("UPDATE attachment SET memo_id = NULL, updated_ts = ? WHERE memo_id = ? AND creator_id = ?")
      .bind(nowTs(), input.memoId, input.creatorId)
      .run();
    return [];
  }

  const placeholders = uniqueAttachmentIds.map(() => "?").join(", ");
  const ownedAttachments = await db
    .prepare(`SELECT id FROM attachment WHERE creator_id = ? AND id IN (${placeholders})`)
    .bind(input.creatorId, ...uniqueAttachmentIds)
    .all<{ id: number }>();
  if ((ownedAttachments.results ?? []).length !== uniqueAttachmentIds.length) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  const now = nowTs();
  await db
    .prepare(
      `
        UPDATE attachment
        SET memo_id = NULL, updated_ts = ?
        WHERE memo_id = ? AND creator_id = ? AND id NOT IN (${placeholders})
      `
    )
    .bind(now, input.memoId, input.creatorId, ...uniqueAttachmentIds)
    .run();

  await db
    .prepare(
      `
        UPDATE attachment
        SET memo_id = ?, updated_ts = ?
        WHERE creator_id = ? AND id IN (${placeholders})
      `
    )
    .bind(input.memoId, now, input.creatorId, ...uniqueAttachmentIds)
    .run();

  const result = await db
    .prepare(
      `
        ${attachmentSelect}
        WHERE creator_id = ? AND memo_id = ? AND id IN (${placeholders})
        ORDER BY created_ts ASC, id ASC
      `
    )
    .bind(input.creatorId, input.memoId, ...uniqueAttachmentIds)
    .all<AttachmentRow>();

  return (result.results ?? []).map(toAttachment);
}

export async function deleteAttachmentMetadata(db: D1Database, id: number): Promise<Attachment | null> {
  const row = await db
    .prepare(
      `
        DELETE FROM attachment
        WHERE id = ?
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          memo_id AS memoId,
          (SELECT uid FROM memo WHERE memo.id = memo_id) AS memoUid,
          filename,
          type,
          size,
          r2_key AS r2Key,
          r2_bucket AS r2Bucket,
          sha256,
          metadata_json AS metadataJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(id)
    .first<AttachmentRow>();

  return row ? toAttachment(row) : null;
}

export async function updateAttachmentMetadata(db: D1Database, input: UpdateAttachmentMetadataInput): Promise<Attachment | null> {
  const assignments: string[] = [];
  const bindings: unknown[] = [];

  if (input.filename !== undefined) {
    if (!input.filename.trim()) {
      throw new HttpError(400, "bad_request", "Attachment filename is required");
    }
    assignments.push("filename = ?");
    bindings.push(input.filename);
  }

  if (input.type !== undefined) {
    assignments.push("type = ?");
    bindings.push(input.type);
  }

  if (input.metadata !== undefined) {
    assignments.push("metadata_json = ?");
    bindings.push(JSON.stringify(input.metadata));
  }

  if (input.memoId !== undefined) {
    assignments.push("memo_id = ?");
    bindings.push(input.memoId);
  }

  if (assignments.length === 0) {
    return getAttachmentById(db, input.id);
  }

  assignments.push("updated_ts = ?");
  bindings.push(nowTs(), input.id, input.creatorId);

  const row = await db
    .prepare(
      `
        UPDATE attachment
        SET ${assignments.join(", ")}
        WHERE id = ? AND creator_id = ?
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          memo_id AS memoId,
          (SELECT uid FROM memo WHERE memo.id = memo_id) AS memoUid,
          filename,
          type,
          size,
          r2_key AS r2Key,
          r2_bucket AS r2Bucket,
          sha256,
          metadata_json AS metadataJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(...bindings)
    .first<AttachmentRow>();
  return row ? toAttachment(row) : null;
}

export async function deleteAttachmentsByIds(db: D1Database, input: { ids: number[]; creatorId: number }): Promise<Attachment[]> {
  const uniqueIds = [...new Set(input.ids)];
  if (uniqueIds.length === 0) {
    return [];
  }
  if (uniqueIds.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
        DELETE FROM attachment
        WHERE creator_id = ? AND id IN (${placeholders})
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          memo_id AS memoId,
          (SELECT uid FROM memo WHERE memo.id = memo_id) AS memoUid,
          filename,
          type,
          size,
          r2_key AS r2Key,
          r2_bucket AS r2Bucket,
          sha256,
          metadata_json AS metadataJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.creatorId, ...uniqueIds)
    .all<AttachmentRow>();
  return (result.results ?? []).map(toAttachment);
}

export async function deleteAttachmentsByUids(db: D1Database, input: { uids: string[]; creatorId: number }): Promise<Attachment[]> {
  const uniqueUids = [...new Set(input.uids)];
  if (uniqueUids.length === 0) {
    return [];
  }
  if (uniqueUids.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }

  const placeholders = uniqueUids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
        DELETE FROM attachment
        WHERE creator_id = ? AND uid IN (${placeholders})
        RETURNING
          id,
          uid,
          creator_id AS creatorId,
          memo_id AS memoId,
          (SELECT uid FROM memo WHERE memo.id = memo_id) AS memoUid,
          filename,
          type,
          size,
          r2_key AS r2Key,
          r2_bucket AS r2Bucket,
          sha256,
          metadata_json AS metadataJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.creatorId, ...uniqueUids)
    .all<AttachmentRow>();
  return (result.results ?? []).map(toAttachment);
}

function validateAttachmentMetadata(input: CreateAttachmentMetadataInput): void {
  if (!input.filename.trim()) {
    throw new HttpError(400, "bad_request", "Attachment filename is required");
  }
  if (!input.r2Key.trim()) {
    throw new HttpError(400, "bad_request", "Attachment R2 key is required");
  }
  if ((input.size ?? 0) < 0) {
    throw new HttpError(400, "bad_request", "Attachment size must be non-negative");
  }
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    uid: row.uid,
    creatorId: row.creatorId,
    memoId: row.memoId ?? undefined,
    memoUid: row.memoUid ?? undefined,
    filename: row.filename,
    type: row.type,
    size: row.size,
    r2Key: row.r2Key,
    r2Bucket: row.r2Bucket,
    sha256: row.sha256,
    metadata: parseMetadata(row.metadataJson),
    createdTs: row.createdTs,
    updatedTs: row.updatedTs
  };
}

function parseMetadata(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}
