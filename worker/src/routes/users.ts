import { Hono } from "hono";
import type { Context } from "hono";

import { canReadOwnedResource, canWriteOwnedResource, isAdmin } from "../auth/permissions";
import type { AppEnv } from "../env";
import { HttpError, notImplemented } from "../http/errors";
import { optionalString, readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth, resolveOptionalAuthContext } from "../middleware/auth";
import { createShortcut, deleteShortcut, listShortcuts, updateShortcut } from "../repositories/shortcuts";
import { getUserSetting, listUserSettings, upsertUserSetting } from "../repositories/user-settings";
import { archiveUser, getUserByUsername, listUsers, updateUser } from "../repositories/users";
import { toUserResponse } from "../serializers/users";
import { parsePositiveId, parseResourceIdOrName, shortcutName } from "../utils/resource-names";

export const userRoutes = new Hono<AppEnv>();

userRoutes.get("/", requireAuth, async (c) => {
  const auth = c.get("auth");
  if (!isAdmin(auth.localUser)) {
    throw new HttpError(403, "permission_denied", "Admin permission required");
  }

  const users = await listUsers(c.env.DB, {
    includeArchived: c.req.query("showDeleted") === "true",
    limit: Number.parseInt(c.req.query("pageSize") ?? "50", 10) || 50
  });
  return c.json(ok({ users: users.map((user) => toUserResponse(user, auth)), totalSize: users.length }));
});

userRoutes.post("/", requireAuth, () => {
  throw notImplemented("Built-in user creation is removed; users are synced from Clerk sessions");
});

userRoutes.get("/:username/settings/:key", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const setting = await getUserSetting(c.env.DB, user.id, c.req.param("key"));
  if (!setting) {
    throw new HttpError(404, "not_found", "User setting not found");
  }
  return c.json(ok({ setting: withUserSettingName(user.username, setting) }));
});

userRoutes.patch("/:username/settings/:key", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const body = await readJsonObject(c);
  const value =
    typeof body.setting === "object" && body.setting !== null && !Array.isArray(body.setting)
      ? (body.setting as Record<string, unknown>).value
      : body.value;
  const setting = await upsertUserSetting(c.env.DB, {
    userId: user.id,
    key: c.req.param("key"),
    value
  });
  return c.json(ok({ setting: withUserSettingName(user.username, setting) }));
});

userRoutes.get("/:username/settings", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const settings = await listUserSettings(c.env.DB, user.id);
  return c.json(ok({ settings: settings.map((setting) => withUserSettingName(user.username, setting)) }));
});

userRoutes.get("/:username/shortcuts", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const shortcuts = await listShortcuts(c.env.DB, user.id);
  return c.json(ok({ shortcuts: shortcuts.map((shortcut) => withShortcutName(user.username, shortcut)) }));
});

userRoutes.post("/:username/shortcuts", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const body = await readJsonObject(c);
  const shortcutBody =
    typeof body.shortcut === "object" && body.shortcut !== null && !Array.isArray(body.shortcut)
      ? (body.shortcut as Record<string, unknown>)
      : body;
  const shortcut = await createShortcut(c.env.DB, {
    creatorId: user.id,
    title: requiredString(shortcutBody, "title"),
    filter: shortcutBody.filter ?? {}
  });
  return c.json(ok({ shortcut: withShortcutName(user.username, shortcut) }), 201);
});

userRoutes.patch("/:username/shortcuts/:shortcutId", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const body = await readJsonObject(c);
  const shortcutBody =
    typeof body.shortcut === "object" && body.shortcut !== null && !Array.isArray(body.shortcut)
      ? (body.shortcut as Record<string, unknown>)
      : body;
  const shortcut = await updateShortcut(c.env.DB, {
    id: parsePositiveId(c.req.param("shortcutId"), "shortcut id"),
    creatorId: user.id,
    title: optionalString(shortcutBody, "title"),
    filter: shortcutBody.filter
  });
  if (!shortcut) {
    throw new HttpError(404, "not_found", "Shortcut not found");
  }
  return c.json(ok({ shortcut: withShortcutName(user.username, shortcut) }));
});

userRoutes.delete("/:username/shortcuts/:shortcutId", requireAuth, async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  requireSelfOrAdmin(c, user.id);
  const shortcut = await deleteShortcut(c.env.DB, {
    id: parsePositiveId(c.req.param("shortcutId"), "shortcut id"),
    creatorId: user.id
  });
  if (!shortcut) {
    throw new HttpError(404, "not_found", "Shortcut not found");
  }
  return c.json(ok({ shortcut: withShortcutName(user.username, shortcut) }));
});

userRoutes.get("/:username/stats", async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  return getUserStatsResponse(c, user.id, user.username);
});

async function getUserStatsResponse(c: Context<AppEnv>, userId: number, username: string) {
  const row = await c.env.DB
    .prepare("SELECT COUNT(1) AS memoCount FROM memo WHERE creator_id = ? AND row_status = 'NORMAL'")
    .bind(userId)
    .first<{ memoCount: number }>();
  return c.json(ok({ name: `users/${username}`, memoCount: Number(row?.memoCount ?? 0) }));
}

userRoutes.get("/:username", async (c) => {
  const user = await requireVisibleUser(c, c.req.param("username"));
  const auth = await resolveOptionalAuthContext(c);
  return c.json(ok({ user: toUserResponse(user, auth) }));
});

userRoutes.patch("/:username", requireAuth, async (c) => {
  const username = parseResourceIdOrName(c.req.param("username"), "users", "user name");
  const user = await requireVisibleUser(c, username);
  const auth = c.get("auth");
  if (!canWriteOwnedResource(auth.localUser, user.id)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }

  const body = await readJsonObject(c);
  const userBody = typeof body.user === "object" && body.user !== null && !Array.isArray(body.user) ? (body.user as Record<string, unknown>) : body;
  const role = parseOptionalRole(userBody.role);
  if (role && !isAdmin(auth.localUser)) {
    throw new HttpError(403, "permission_denied", "Only admins can update roles");
  }
  const updated = await updateUser(c.env.DB, {
    username,
    email: optionalString(userBody, "email"),
    nickname: optionalString(userBody, "displayName") ?? optionalString(userBody, "nickname"),
    avatarUrl: optionalString(userBody, "avatarUrl"),
    role
  });
  if (!updated) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return c.json(ok({ user: toUserResponse(updated, auth) }));
});

userRoutes.delete("/:username", requireAuth, async (c) => {
  const username = parseResourceIdOrName(c.req.param("username"), "users", "user name");
  const auth = c.get("auth");
  if (!isAdmin(auth.localUser)) {
    throw new HttpError(403, "permission_denied", "Admin permission required");
  }
  const deleted = await archiveUser(c.env.DB, username);
  if (!deleted) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return c.json(ok({ user: toUserResponse(deleted, auth) }));
});

userRoutes.all("/:username/webhooks", () => {
  throw notImplemented("User webhooks are not implemented in the Cloudflare Worker backend yet");
});

userRoutes.all("/:username/webhooks/*", () => {
  throw notImplemented("User webhooks are not implemented in the Cloudflare Worker backend yet");
});

userRoutes.all("/:username/notifications", () => {
  throw notImplemented("Inbox notifications are not implemented in the Cloudflare Worker backend yet");
});

userRoutes.all("/:username/notifications/*", () => {
  throw notImplemented("Inbox notifications are not implemented in the Cloudflare Worker backend yet");
});

async function requireVisibleUser(c: Context<AppEnv>, usernameOrName: string) {
  const username = parseResourceIdOrName(usernameOrName, "users", "user name");
  const user = await getUserByUsername(c.env.DB, username);
  if (!user) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return user;
}

function requireSelfOrAdmin(c: Context<AppEnv>, userId: number): void {
  const auth = c.get("auth");
  if (!canReadOwnedResource(auth.localUser, userId)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }
}

function parseOptionalRole(value: unknown): "ADMIN" | "USER" | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === "ADMIN" || value === "USER") {
    return value;
  }
  throw new HttpError(400, "bad_request", "Invalid user role");
}

function withUserSettingName(username: string, setting: { key: string; value: unknown }) {
  return {
    ...setting,
    name: `users/${username}/settings/${setting.key}`
  };
}

function withShortcutName(username: string, shortcut: { id: number; title: string; filter: unknown; createdTs: number; updatedTs: number }) {
  return {
    ...shortcut,
    name: shortcutName(username, shortcut.id)
  };
}
