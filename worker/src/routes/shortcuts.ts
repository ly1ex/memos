import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { intPathParam, optionalString, readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth } from "../middleware/auth";
import { createShortcut, deleteShortcut, listShortcuts, updateShortcut } from "../repositories/shortcuts";

export const shortcutRoutes = new Hono<AppEnv>();

shortcutRoutes.use("*", requireAuth);

shortcutRoutes.get("/", async (c) => {
  const shortcuts = await listShortcuts(c.env.DB, c.get("auth").localUser.id);
  return c.json(ok({ shortcuts }));
});

shortcutRoutes.post("/", async (c) => {
  const body = await readJsonObject(c);
  const shortcut = await createShortcut(c.env.DB, {
    creatorId: c.get("auth").localUser.id,
    title: requiredString(body, "title"),
    filter: body.filter ?? {}
  });

  return c.json(ok({ shortcut }), 201);
});

shortcutRoutes.patch("/:id", async (c) => {
  const body = await readJsonObject(c);
  const shortcut = await updateShortcut(c.env.DB, {
    id: intPathParam(c, "id"),
    creatorId: c.get("auth").localUser.id,
    title: optionalString(body, "title"),
    filter: body.filter
  });

  if (!shortcut) {
    throw new HttpError(404, "not_found", "Shortcut not found");
  }

  return c.json(ok({ shortcut }));
});

shortcutRoutes.delete("/:id", async (c) => {
  const shortcut = await deleteShortcut(c.env.DB, {
    id: intPathParam(c, "id"),
    creatorId: c.get("auth").localUser.id
  });

  if (!shortcut) {
    throw new HttpError(404, "not_found", "Shortcut not found");
  }

  return c.json(ok({ shortcut }));
});

