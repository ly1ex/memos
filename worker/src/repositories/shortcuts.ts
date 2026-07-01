import { HttpError } from "../http/errors";
import { nowTs } from "../utils/time";

export interface Shortcut {
  id: number;
  creatorId: number;
  title: string;
  filter: unknown;
  createdTs: number;
  updatedTs: number;
}

interface ShortcutRow {
  id: number;
  creatorId: number;
  title: string;
  filterJson: string;
  createdTs: number;
  updatedTs: number;
}

const shortcutSelect = `
  SELECT
    id,
    creator_id AS creatorId,
    title,
    filter_json AS filterJson,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM shortcut
`;

export async function listShortcuts(db: D1Database, creatorId: number): Promise<Shortcut[]> {
  const result = await db
    .prepare(`${shortcutSelect} WHERE creator_id = ? ORDER BY created_ts ASC, id ASC`)
    .bind(creatorId)
    .all<ShortcutRow>();
  return (result.results ?? []).map(toShortcut);
}

export async function createShortcut(db: D1Database, input: { creatorId: number; title: string; filter: unknown }): Promise<Shortcut> {
  validateTitle(input.title);
  const now = nowTs();
  const row = await db
    .prepare(
      `
        INSERT INTO shortcut (creator_id, title, filter_json, created_ts, updated_ts)
        VALUES (?, ?, ?, ?, ?)
        RETURNING
          id,
          creator_id AS creatorId,
          title,
          filter_json AS filterJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.creatorId, input.title, JSON.stringify(input.filter ?? {}), now, now)
    .first<ShortcutRow>();

  if (!row) {
    throw new Error("Failed to create shortcut");
  }
  return toShortcut(row);
}

export async function updateShortcut(
  db: D1Database,
  input: { id: number; creatorId: number; title?: string; filter?: unknown }
): Promise<Shortcut | null> {
  const assignments: string[] = [];
  const bindings: unknown[] = [];

  if (input.title !== undefined) {
    validateTitle(input.title);
    assignments.push("title = ?");
    bindings.push(input.title);
  }

  if (input.filter !== undefined) {
    assignments.push("filter_json = ?");
    bindings.push(JSON.stringify(input.filter));
  }

  if (assignments.length === 0) {
    return getShortcut(db, input.id, input.creatorId);
  }

  assignments.push("updated_ts = ?");
  bindings.push(nowTs(), input.id, input.creatorId);

  const row = await db
    .prepare(
      `
        UPDATE shortcut
        SET ${assignments.join(", ")}
        WHERE id = ? AND creator_id = ?
        RETURNING
          id,
          creator_id AS creatorId,
          title,
          filter_json AS filterJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(...bindings)
    .first<ShortcutRow>();
  return row ? toShortcut(row) : null;
}

export async function deleteShortcut(db: D1Database, input: { id: number; creatorId: number }): Promise<Shortcut | null> {
  const row = await db
    .prepare(
      `
        DELETE FROM shortcut
        WHERE id = ? AND creator_id = ?
        RETURNING
          id,
          creator_id AS creatorId,
          title,
          filter_json AS filterJson,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.id, input.creatorId)
    .first<ShortcutRow>();
  return row ? toShortcut(row) : null;
}

async function getShortcut(db: D1Database, id: number, creatorId: number): Promise<Shortcut | null> {
  const row = await db.prepare(`${shortcutSelect} WHERE id = ? AND creator_id = ? LIMIT 1`).bind(id, creatorId).first<ShortcutRow>();
  return row ? toShortcut(row) : null;
}

function validateTitle(title: string): void {
  if (title.trim() === "") {
    throw new HttpError(400, "bad_request", "Shortcut title is required");
  }
  if (title.length > 120) {
    throw new HttpError(400, "bad_request", "Shortcut title is too long");
  }
}

function toShortcut(row: ShortcutRow): Shortcut {
  return {
    id: row.id,
    creatorId: row.creatorId,
    title: row.title,
    filter: parseFilter(row.filterJson),
    createdTs: row.createdTs,
    updatedTs: row.updatedTs
  };
}

function parseFilter(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

