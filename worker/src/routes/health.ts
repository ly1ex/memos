import { Hono } from "hono";

import type { AppEnv } from "../env";
import { ok } from "../http/responses";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) =>
  c.json(
    ok({
      name: "memos-cloudflare-worker",
      status: "ok"
    })
  )
);

healthRoutes.get("/healthz", (c) =>
  c.json(
    ok({
      status: "ok"
    })
  )
);

