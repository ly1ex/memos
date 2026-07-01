import type { Context } from "hono";

import type { AppEnv } from "../env";
import { enqueueJob } from "../repositories/jobs";

export function scheduleR2Delete(c: Context<AppEnv>, r2Key: string): void {
  c.executionCtx.waitUntil(
    c.env.ATTACHMENTS.delete(r2Key).catch(async (error) => {
      console.error("Failed to delete R2 object, enqueueing retry", error);
      await enqueueJob(c.env.DB, {
        type: "R2_DELETE",
        payload: { r2Key }
      });
    })
  );
}

