import { createMiddleware } from "hono/factory";

import { isAdmin } from "../auth/permissions";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { requireAuth } from "./auth";

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  await requireAuth(c, async () => {
    const auth = c.get("auth");
    if (!isAdmin(auth.localUser)) {
      throw new HttpError(403, "permission_denied", "Admin permission required");
    }
    await next();
  });
});

