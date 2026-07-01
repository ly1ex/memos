import { nowTs } from "../utils/time";

export interface Reaction {
  id: number;
  creatorId: number;
  memoId: number;
  type: string;
  createdTs: number;
}

interface ReactionRow {
  id: number;
  creatorId: number;
  memoId: number;
  type: string;
  createdTs: number;
}

const reactionSelect = `
  SELECT
    id,
    creator_id AS creatorId,
    memo_id AS memoId,
    type,
    created_ts AS createdTs
  FROM reaction
`;

export async function listMemoReactions(db: D1Database, memoId: number): Promise<Reaction[]> {
  const result = await db
    .prepare(`${reactionSelect} WHERE memo_id = ? ORDER BY created_ts ASC, id ASC`)
    .bind(memoId)
    .all<ReactionRow>();
  return result.results ?? [];
}

export async function upsertMemoReaction(db: D1Database, input: { memoId: number; creatorId: number; type: string }): Promise<Reaction> {
  const now = nowTs();
  const row = await db
    .prepare(
      `
        INSERT INTO reaction (creator_id, memo_id, type, created_ts)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(creator_id, memo_id, type) DO UPDATE SET type = excluded.type
        RETURNING
          id,
          creator_id AS creatorId,
          memo_id AS memoId,
          type,
          created_ts AS createdTs
      `
    )
    .bind(input.creatorId, input.memoId, input.type, now)
    .first<ReactionRow>();

  if (!row) {
    throw new Error("Failed to upsert memo reaction");
  }
  return row;
}

export async function deleteMemoReaction(db: D1Database, input: { memoId: number; creatorId: number; type: string }): Promise<Reaction | null> {
  const row = await db
    .prepare(
      `
        DELETE FROM reaction
        WHERE memo_id = ? AND creator_id = ? AND type = ?
        RETURNING
          id,
          creator_id AS creatorId,
          memo_id AS memoId,
          type,
          created_ts AS createdTs
      `
    )
    .bind(input.memoId, input.creatorId, input.type)
    .first<ReactionRow>();
  return row ?? null;
}

