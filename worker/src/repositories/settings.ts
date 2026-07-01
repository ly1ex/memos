export interface SystemSetting {
  name: string;
  value: unknown;
  description: string;
}

interface SystemSettingRow {
  name: string;
  value: string;
  description: string;
}

export async function getSystemSetting(db: D1Database, name: string): Promise<SystemSetting | null> {
  const row = await db.prepare("SELECT name, value, description FROM system_setting WHERE name = ? LIMIT 1").bind(name).first<SystemSettingRow>();
  return row ? toSystemSetting(row) : null;
}

export async function listSystemSettingsByNames(db: D1Database, names: string[]): Promise<SystemSetting[]> {
  const uniqueNames = [...new Set(names)].filter(Boolean);
  if (uniqueNames.length === 0) {
    return [];
  }

  const placeholders = uniqueNames.map(() => "?").join(", ");
  const result = await db
    .prepare(`SELECT name, value, description FROM system_setting WHERE name IN (${placeholders}) ORDER BY name ASC`)
    .bind(...uniqueNames)
    .all<SystemSettingRow>();
  return (result.results ?? []).map(toSystemSetting);
}

export async function upsertSystemSetting(
  db: D1Database,
  input: { name: string; value: unknown; description?: string }
): Promise<SystemSetting> {
  const valueJson = JSON.stringify(input.value ?? null);
  const row = await db
    .prepare(
      `
        INSERT INTO system_setting (name, value, description)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          value = excluded.value,
          description = excluded.description
        RETURNING name, value, description
      `
    )
    .bind(input.name, valueJson, input.description ?? "")
    .first<SystemSettingRow>();

  if (!row) {
    throw new Error("Failed to upsert system setting");
  }
  return toSystemSetting(row);
}

function toSystemSetting(row: SystemSettingRow): SystemSetting {
  return {
    name: row.name,
    value: parseValue(row.value),
    description: row.description
  };
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

