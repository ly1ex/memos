import { nowTs } from "../utils/time";

export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type JobType = "R2_DELETE" | "STATS_SNAPSHOT";

export interface Job {
  id: number;
  type: string;
  status: JobStatus;
  payload: unknown;
  attempts: number;
  nextAttemptTs: number;
  lastError: string;
  createdTs: number;
  updatedTs: number;
}

interface JobRow {
  id: number;
  type: string;
  status: JobStatus;
  payloadJson: string;
  attempts: number;
  nextAttemptTs: number;
  lastError: string;
  createdTs: number;
  updatedTs: number;
}

const jobSelect = `
  SELECT
    id,
    type,
    status,
    payload_json AS payloadJson,
    attempts,
    next_attempt_ts AS nextAttemptTs,
    last_error AS lastError,
    created_ts AS createdTs,
    updated_ts AS updatedTs
  FROM job_queue
`;

export async function enqueueJob(db: D1Database, input: { type: JobType; payload: unknown; nextAttemptTs?: number }): Promise<Job> {
  const now = nowTs();
  const row = await db
    .prepare(
      `
        INSERT INTO job_queue (type, status, payload_json, attempts, next_attempt_ts, created_ts, updated_ts)
        VALUES (?, 'PENDING', ?, 0, ?, ?, ?)
        RETURNING
          id,
          type,
          status,
          payload_json AS payloadJson,
          attempts,
          next_attempt_ts AS nextAttemptTs,
          last_error AS lastError,
          created_ts AS createdTs,
          updated_ts AS updatedTs
      `
    )
    .bind(input.type, JSON.stringify(input.payload ?? {}), input.nextAttemptTs ?? now, now, now)
    .first<JobRow>();

  if (!row) {
    throw new Error("Failed to enqueue job");
  }
  return toJob(row);
}

export async function listDueJobs(db: D1Database, limit: number): Promise<Job[]> {
  const result = await db
    .prepare(
      `
        ${jobSelect}
        WHERE status IN ('PENDING', 'FAILED') AND next_attempt_ts <= ?
        ORDER BY next_attempt_ts ASC, id ASC
        LIMIT ?
      `
    )
    .bind(nowTs(), Math.min(limit, 50))
    .all<JobRow>();
  return (result.results ?? []).map(toJob);
}

export async function markJobRunning(db: D1Database, jobId: number): Promise<void> {
  await db.prepare("UPDATE job_queue SET status = 'RUNNING', attempts = attempts + 1, updated_ts = ? WHERE id = ?").bind(nowTs(), jobId).run();
}

export async function markJobDone(db: D1Database, jobId: number): Promise<void> {
  await db.prepare("UPDATE job_queue SET status = 'DONE', last_error = '', updated_ts = ? WHERE id = ?").bind(nowTs(), jobId).run();
}

export async function markJobFailed(db: D1Database, jobId: number, error: string): Promise<void> {
  const nextAttemptTs = nowTs() + 60;
  await db
    .prepare("UPDATE job_queue SET status = 'FAILED', last_error = ?, next_attempt_ts = ?, updated_ts = ? WHERE id = ?")
    .bind(error.slice(0, 500), nextAttemptTs, nowTs(), jobId)
    .run();
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: parsePayload(row.payloadJson),
    attempts: row.attempts,
    nextAttemptTs: row.nextAttemptTs,
    lastError: row.lastError,
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

