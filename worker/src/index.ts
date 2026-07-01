import app from "./app";
import type { Env } from "./env";
import { scheduledHandler } from "./jobs/scheduled";

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler
} satisfies ExportedHandler<Env>;

