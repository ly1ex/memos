import { Hono } from "hono";

import type { AppEnv } from "../env";
import { notImplemented } from "../http/errors";
import { requireAuth } from "../middleware/auth";
import { ok } from "../http/responses";
import { toUserResponse } from "../serializers/users";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/signin", () => {
  throw notImplemented("Built-in sign-in is removed; use Clerk session authentication");
});

authRoutes.get("/me", requireAuth, (c) => {
  const auth = c.get("auth");
  return c.json(
    ok({
      auth: {
        clerkUserId: auth.clerkUserId,
        sessionId: auth.sessionId
      },
      user: toUserResponse(auth.localUser, auth)
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

authRoutes.post("/refresh", () => {
  throw notImplemented("Access-token refresh is managed by Clerk in the Cloudflare Worker backend");
});
