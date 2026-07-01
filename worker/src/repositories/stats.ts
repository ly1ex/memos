export interface InstanceStats {
  users: number;
  memos: number;
  attachments: number;
  shares: number;
}

export async function getInstanceStats(db: D1Database): Promise<InstanceStats> {
  const [users, memos, attachments, shares] = await Promise.all([
    count(db, `"user"`, "row_status = 'NORMAL'"),
    count(db, "memo", "row_status = 'NORMAL'"),
    count(db, "attachment"),
    count(db, "memo_share")
  ]);

  return {
    users,
    memos,
    attachments,
    shares
  };
}

export async function recordInstanceStatsSnapshot(db: D1Database): Promise<InstanceStats> {
  const stats = await getInstanceStats(db);
  const createdTs = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
        INSERT OR REPLACE INTO stat_snapshot (key, value_json, created_ts)
        VALUES ('instance', ?, ?)
      `
    )
    .bind(JSON.stringify(stats), createdTs)
    .run();
  return stats;
}

async function count(db: D1Database, table: string, where?: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(1) AS count FROM ${table}${where ? ` WHERE ${where}` : ""}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}
