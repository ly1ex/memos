import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { ok } from "../http/responses";
import { getUserByUsername } from "../repositories/users";
import { toUserResponse } from "../serializers/users";

export const userRoutes = new Hono<AppEnv>();

userRoutes.get("/:username", async (c) => {
  const user = await getUserByUsername(c.env.DB, c.req.param("username"));
  if (!user) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return c.json(ok({ user: toUserResponse(user) }));
});

