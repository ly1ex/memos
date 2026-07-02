import type { LocalUser, UserRole } from "../env";

interface UserRow {
  id: number;
  clerkUserId: string;
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: UserRole;
  rowStatus: "NORMAL" | "ARCHIVED";
  createdTs: number;
  updatedTs: number;
}

const userSelect = `
  SELECT
    id,
    clerk_user_id AS clerkUserId,
    username,
    email,
    nickname,
    avatar_url AS avatarUrl,
    role,
    row_status AS rowStatus,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM "user"
`;

export async function getUserByClerkUserId(db: D1Database, clerkUserId: string): Promise<LocalUser | null> {
  const row = await db.prepare(`${userSelect} WHERE clerk_user_id = ? LIMIT 1`).bind(clerkUserId).first<UserRow>();
  return row ?? null;
}

export async function getUserByUsername(db: D1Database, username: string): Promise<LocalUser | null> {
  const row = await db.prepare(`${userSelect} WHERE username = ? AND row_status = 'NORMAL' LIMIT 1`).bind(username).first<UserRow>();
  return row ?? null;
}

export async function getUserById(db: D1Database, id: number): Promise<LocalUser | null> {
  const row = await db.prepare(`${userSelect} WHERE id = ? AND row_status = 'NORMAL' LIMIT 1`).bind(id).first<UserRow>();
  return row ?? null;
}

export async function listUsers(db: D1Database, input: { includeArchived?: boolean; limit?: number; offset?: number } = {}): Promise<LocalUser[]> {
  const where = input.includeArchived ? "1 = 1" : "row_status = 'NORMAL'";
  const result = await db
    .prepare(`${userSelect} WHERE ${where} ORDER BY created_ts ASC, id ASC LIMIT ? OFFSET ?`)
    .bind(Math.min(input.limit ?? 50, 1000), input.offset ?? 0)
    .all<UserRow>();
  return result.results ?? [];
}

export async function batchGetUsersByUsernames(db: D1Database, usernames: string[]): Promise<LocalUser[]> {
  const uniqueUsernames = [...new Set(usernames.map((username) => username.trim()).filter(Boolean))];
  if (uniqueUsernames.length === 0) {
    return [];
  }
  const placeholders = uniqueUsernames.map(() => "?").join(", ");
  const result = await db
    .prepare(`${userSelect} WHERE username IN (${placeholders}) AND row_status = 'NORMAL' ORDER BY username ASC`)
    .bind(...uniqueUsernames)
    .all<UserRow>();
  return result.results ?? [];
}

export async function updateUser(
  db: D1Database,
  input: { username: string; email?: string; nickname?: string; avatarUrl?: string; role?: UserRole }
): Promise<LocalUser | null> {
  const assignments: string[] = [];
  const bindings: unknown[] = [];

  if (input.email !== undefined) {
    assignments.push("email = ?");
    bindings.push(input.email);
  }
  if (input.nickname !== undefined) {
    assignments.push("nickname = ?");
    bindings.push(input.nickname);
  }
  if (input.avatarUrl !== undefined) {
    assignments.push("avatar_url = ?");
    bindings.push(input.avatarUrl);
  }
  if (input.role !== undefined) {
    assignments.push("role = ?");
    bindings.push(input.role);
  }
  if (assignments.length === 0) {
    return getUserByUsername(db, input.username);
  }

  assignments.push("updated_ts = ?");
  bindings.push(Math.floor(Date.now() / 1000), input.username);

  const row = await db
    .prepare(
      `
        UPDATE "user"
        SET ${assignments.join(", ")}
        WHERE username = ? AND row_status = 'NORMAL'
        RETURNING
          id,
          clerk_user_id AS clerkUserId,
          username,
          email,
          nickname,
          avatar_url AS avatarUrl,
          role,
          row_status AS rowStatus,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(...bindings)
    .first<UserRow>();
  return row ?? null;
}

export async function archiveUser(db: D1Database, username: string): Promise<LocalUser | null> {
  const row = await db
    .prepare(
      `
        UPDATE "user"
        SET row_status = 'ARCHIVED', updated_ts = ?
        WHERE username = ? AND row_status = 'NORMAL'
        RETURNING
          id,
          clerk_user_id AS clerkUserId,
          username,
          email,
          nickname,
          avatar_url AS avatarUrl,
          role,
          row_status AS rowStatus,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(Math.floor(Date.now() / 1000), username)
    .first<UserRow>();
  return row ?? null;
}

export async function getOrCreateUserByClerkUserId(db: D1Database, clerkUserId: string): Promise<LocalUser> {
  const existing = await getUserByClerkUserId(db, clerkUserId);
  if (existing) {
    return existing;
  }

  const role = (await countActiveAdmins(db)) === 0 ? "ADMIN" : "USER";
  const username = usernameFromClerkUserId(clerkUserId);
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        `
          INSERT INTO "user" (
            clerk_user_id,
            username,
            email,
            nickname,
            avatar_url,
            role,
            row_status,
            created_ts,
            updated_ts
          ) VALUES (?, ?, '', '', '', ?, 'NORMAL', ?, ?)
        `
      )
      .bind(clerkUserId, username, role, now, now)
      .run();
  } catch (error) {
    const raced = await getUserByClerkUserId(db, clerkUserId);
    if (raced) {
      return raced;
    }
    throw error;
  }

  const created = await getUserByClerkUserId(db, clerkUserId);
  if (!created) {
    throw new Error("Failed to load user after creation");
  }
  return created;
}

async function countActiveAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(1) AS count FROM "user" WHERE role = 'ADMIN' AND row_status = 'NORMAL'`)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

function usernameFromClerkUserId(clerkUserId: string): string {
  const normalized = clerkUserId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const trimmed = normalized.length > 48 ? normalized.slice(0, 48) : normalized;
  return trimmed.startsWith("user_") ? trimmed : `user_${trimmed}`;
}
