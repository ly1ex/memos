import type { Env } from "../env";
import { listDueJobs, markJobDone, markJobFailed, markJobRunning, type Job } from "../repositories/jobs";
import { recordInstanceStatsSnapshot } from "../repositories/stats";

export async function scheduledHandler(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(runScheduledJobs(env));
}

async function runScheduledJobs(env: Env): Promise<void> {
  await recordInstanceStatsSnapshot(env.DB);

  const jobs = await listDueJobs(env.DB, 20);
  for (const job of jobs) {
    await processJob(env, job);
  }
}

async function processJob(env: Env, job: Job): Promise<void> {
  await markJobRunning(env.DB, job.id);
  try {
    switch (job.type) {
      case "R2_DELETE":
        await processR2DeleteJob(env, job);
        break;
      case "STATS_SNAPSHOT":
        await recordInstanceStatsSnapshot(env.DB);
        break;
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }
    await markJobDone(env.DB, job.id);
  } catch (error) {
    await markJobFailed(env.DB, job.id, error instanceof Error ? error.message : String(error));
  }
}

async function processR2DeleteJob(env: Env, job: Job): Promise<void> {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    throw new Error("Invalid R2_DELETE payload");
  }
  const r2Key = (job.payload as Record<string, unknown>).r2Key;
  if (typeof r2Key !== "string" || r2Key.trim() === "") {
    throw new Error("Missing R2 key");
  }
  await env.ATTACHMENTS.delete(r2Key);
}
