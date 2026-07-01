import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAdmin } from "../middleware/admin";
import { getSystemSetting, listSystemSettingsByNames, upsertSystemSetting } from "../repositories/settings";
import { getInstanceStats } from "../repositories/stats";

export const instanceRoutes = new Hono<AppEnv>();

instanceRoutes.get("/profile", (c) =>
  c.json(
    ok({
      mode: "cloudflare-worker",
      authProvider: "clerk",
      database: "d1",
      objectStorage: "r2",
      realtime: "polling",
      mcp: true
    })
  )
);

instanceRoutes.get("/settings/:key", async (c) => {
  const setting = await getSystemSetting(c.env.DB, c.req.param("key"));
  if (!setting) {
    throw new HttpError(404, "not_found", "Instance setting not found");
  }
  return c.json(ok({ setting }));
});

instanceRoutes.get("/settings:batchGet", async (c) => {
  const names = (c.req.query("names") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const settings = await listSystemSettingsByNames(c.env.DB, names);
  return c.json(ok({ settings }));
});

instanceRoutes.patch("/settings/:key", requireAdmin, async (c) => {
  const body = await readJsonObject(c);
  const setting = await upsertSystemSetting(c.env.DB, {
    name: c.req.param("key"),
    value: body.value,
    description: body.description === undefined ? "" : requiredString(body, "description")
  });
  return c.json(ok({ setting }));
});

instanceRoutes.get("/stats", async (c) => {
  const stats = await getInstanceStats(c.env.DB);
  return c.json(ok({ stats }));
});

