import { HttpError } from "../http/errors";
import { nowTs } from "../utils/time";
import { createUid } from "../utils/uid";
import type { Memo } from "./memos";

export interface MemoShare {
  id: number;
  memoId: number;
  creatorId: number;
  shareId: string;
  expiresTs?: number;
  createdTs: number;
  updatedTs: number;
}

interface MemoShareRow {
  id: number;
  memoId: number;
  creatorId: number;
  shareId: string;
  expiresTs: number | null;
  createdTs: number;
  updatedTs: number;
}

interface MemoShareWithMemoRow extends MemoShareRow {
  memoUid: string;
  memoCreatorId: number;
  content: string;
  visibility: "PUBLIC" | "PROTECTED" | "PRIVATE";
  rowStatus: "NORMAL" | "ARCHIVED";
  pinned: number;
  payloadJson: string;
  memoCreatedTs: number;
  memoUpdatedTs: number;
}

const shareSelect = `
  SELECT
    id,
    memo_id AS memoId,
    creator_id AS creatorId,
    share_id AS shareId,
    expires_ts AS expiresTs,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM memo_share
`;

export async function createMemoShare(
  db: D1Database,
  input: { memoId: number; creatorId: number; expiresTs?: number }
): Promise<MemoShare> {
  if (input.expiresTs !== undefined && input.expiresTs <= nowTs()) {
    throw new HttpError(400, "bad_request", "Share expiration must be in the future");
  }

  const now = nowTs();
  const shareId = createUid("share");
  const row = await db
    .prepare(
      `
        INSERT INTO memo_share (memo_id, creator_id, share_id, expires_ts, created_ts, updated_ts)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING
          id,
          memo_id AS memoId,
          creator_id AS creatorId,
          share_id AS shareId,
          expires_ts AS expiresTs,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.memoId, input.creatorId, shareId, input.expiresTs ?? null, now, now)
    .first<MemoShareRow>();

  if (!row) {
    throw new Error("Failed to create memo share");
  }
  return toMemoShare(row);
}

export async function listMemoShares(db: D1Database, memoId: number): Promise<MemoShare[]> {
  const result = await db
    .prepare(`${shareSelect} WHERE memo_id = ? ORDER BY created_ts DESC, id DESC`)
    .bind(memoId)
    .all<MemoShareRow>();
  return (result.results ?? []).map(toMemoShare);
}

export async function deleteMemoShare(db: D1Database, shareId: string): Promise<MemoShare | null> {
  const row = await db
    .prepare(
      `
        DELETE FROM memo_share
        WHERE share_id = ?
        RETURNING
          id,
          memo_id AS memoId,
          creator_id AS creatorId,
          share_id AS shareId,
          expires_ts AS expiresTs,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(shareId)
    .first<MemoShareRow>();
  return row ? toMemoShare(row) : null;
}

export async function getMemoShareByShareId(db: D1Database, shareId: string): Promise<MemoShare | null> {
  const row = await db.prepare(`${shareSelect} WHERE share_id = ? LIMIT 1`).bind(shareId).first<MemoShareRow>();
  return row ? toMemoShare(row) : null;
}

export async function getSharedMemo(db: D1Database, shareId: string): Promise<{ share: MemoShare; memo: Memo } | null> {
  const row = await db
    .prepare(
      `
        SELECT
          share.id,
          share.memo_id AS memoId,
          share.creator_id AS creatorId,
          share.share_id AS shareId,
          share.expires_ts AS expiresTs,
          share.created_ts AS createdTs,
          share.updated_ts AS updatedTs,
          memo.uid AS memoUid,
          memo.creator_id AS memoCreatorId,
          memo.content,
          memo.visibility,
          memo.row_status AS rowStatus,
          memo.pinned,
          memo.payload_json AS payloadJson,
          memo.created_ts AS memoCreatedTs,
          memo.updated_ts AS memoUpdatedTs
        FROM memo_share AS share
        JOIN memo ON memo.id = share.memo_id
        WHERE share.share_id = ?
        LIMIT 1
      `
    )
    .bind(shareId)
    .first<MemoShareWithMemoRow>();

  if (!row) {
    return null;
  }

  const share = toMemoShare(row);
  if ((share.expiresTs !== undefined && share.expiresTs <= nowTs()) || row.rowStatus !== "NORMAL") {
    return null;
  }

  return {
    share,
    memo: {
      id: row.memoId,
      uid: row.memoUid,
      creatorId: row.memoCreatorId,
      content: row.content,
      visibility: row.visibility,
      rowStatus: row.rowStatus,
      pinned: row.pinned === 1,
      payload: parsePayload(row.payloadJson),
      createdTs: row.memoCreatedTs,
      updatedTs: row.memoUpdatedTs
    }
  };
}

function toMemoShare(row: MemoShareRow): MemoShare {
  return {
    id: row.id,
    memoId: row.memoId,
    creatorId: row.creatorId,
    shareId: row.shareId,
    expiresTs: row.expiresTs ?? undefined,
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

