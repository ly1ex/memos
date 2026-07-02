export interface UserSetting {
  userId: number;
  key: string;
  value: unknown;
}

interface UserSettingRow {
  userId: number;
  key: string;
  value: string;
}

const userSettingSelect = `
  SELECT
    user_id AS userId,
    key,
    value
  FROM user_setting
`;

export async function getUserSetting(db: D1Database, userId: number, key: string): Promise<UserSetting | null> {
  const row = await db.prepare(`${userSettingSelect} WHERE user_id = ? AND key = ? LIMIT 1`).bind(userId, key).first<UserSettingRow>();
  return row ? toUserSetting(row) : null;
}

export async function listUserSettings(db: D1Database, userId: number): Promise<UserSetting[]> {
  const result = await db.prepare(`${userSettingSelect} WHERE user_id = ? ORDER BY key ASC`).bind(userId).all<UserSettingRow>();
  return (result.results ?? []).map(toUserSetting);
}

export async function upsertUserSetting(db: D1Database, input: UserSetting): Promise<UserSetting> {
  const row = await db
    .prepare(
      `
        INSERT INTO user_setting (user_id, key, value)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
        RETURNING user_id AS userId, key, value
      `
    )
    .bind(input.userId, input.key, JSON.stringify(input.value ?? null))
    .first<UserSettingRow>();

  if (!row) {
    throw new Error("Failed to upsert user setting");
  }
  return toUserSetting(row);
}

function toUserSetting(row: UserSettingRow): UserSetting {
  return {
    userId: row.userId,
    key: row.key,
    value: parseValue(row.value)
  };
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}
