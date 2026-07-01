import { Hono } from "hono";

import type { AppEnv } from "../env";
import { requireAuth } from "../middleware/auth";
import { ok } from "../http/responses";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/me", requireAuth, (c) => {
  const auth = c.get("auth");
  return c.json(
    ok({
      auth: {
        clerkUserId: auth.clerkUserId,
        sessionId: auth.sessionId
      },
      user: auth.localUser
    })
  );
});

authRoutes.post("/signout", (c) =>
  c.json(
    ok({
      handledBy: "clerk"
    })
  )
);

