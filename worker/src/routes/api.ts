import { Hono } from "hono";
import type { Context } from "hono";

import { isAdmin } from "../auth/permissions";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { readJsonObject } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth, resolveOptionalAuthContext } from "../middleware/auth";
import { scheduleR2Delete } from "../r2/delete";
import { deleteAttachmentsByIds, deleteAttachmentsByUids } from "../repositories/attachments";
import { batchGetUsersByUsernames } from "../repositories/users";
import { toAttachmentResponse } from "../serializers/attachments";
import { toUserResponse } from "../serializers/users";
import { parseAttachmentName, parseResourceIdOrName } from "../utils/resource-names";
import { attachmentRoutes } from "./attachments";
import { authRoutes } from "./auth";
import { instanceRoutes } from "./instance";
import { memoRoutes } from "./memos";
import { shareRoutes } from "./shares";
import { shortcutRoutes } from "./shortcuts";
import { userRoutes } from "./users";

export const apiRoutes = new Hono<AppEnv>();

apiRoutes.route("/auth", authRoutes);

apiRoutes.post("/users:sync", requireAuth, (c) => {
  const auth = c.get("auth");
  return c.json(ok({ user: toUserResponse(auth.localUser, auth) }));
});

apiRoutes.post("/users:batchGet", async (c) => {
  const body = await readJsonObject(c);
  const usernames = parseUsernames(body.usernames).map((username) => parseResourceIdOrName(username, "users", "user name"));
  const users = await batchGetUsersByUsernames(c.env.DB, usernames);
  const auth = await resolveOptionalAuthContext(c);
  return c.json(ok({ users: users.map((user) => toUserResponse(user, auth)) }));
});

apiRoutes.get("/users/stats", requireAuth, listAllUserStats);

apiRoutes.get("/users:stats", requireAuth, listAllUserStats);

async function listAllUserStats(c: Context<AppEnv>) {
  const auth = c.get("auth");
  if (!isAdmin(auth.localUser)) {
    throw new HttpError(403, "permission_denied", "Admin permission required");
  }
  const rows = await c.env.DB
    .prepare(
      `
        SELECT
          "user".username,
          COUNT(memo.id) AS memoCount
        FROM "user"
        LEFT JOIN memo ON memo.creator_id = "user".id AND memo.row_status = 'NORMAL'
        WHERE "user".row_status = 'NORMAL'
        GROUP BY "user".id
        ORDER BY "user".username ASC
      `
    )
    .all<{ username: string; memoCount: number }>();
  return c.json(ok({ stats: rows.results ?? [] }));
}

apiRoutes.route("/instance", instanceRoutes);

apiRoutes.route("/users", userRoutes);

apiRoutes.route("/memos", memoRoutes);

apiRoutes.post("/attachments:batchDelete", requireAuth, async (c) => {
  const body = await readJsonObject(c);
  const creatorId = c.get("auth").localUser.id;
  const attachments = Array.isArray(body.names)
    ? await deleteAttachmentsByUids(c.env.DB, {
        uids: parseAttachmentNames(body.names),
        creatorId
      })
    : await deleteAttachmentsByIds(c.env.DB, {
        ids: parseAttachmentIds(body.attachmentIds),
        creatorId
      });

  for (const attachment of attachments) {
    scheduleR2Delete(c, attachment.r2Key);
  }

  return c.json(ok({ attachments: attachments.map(toAttachmentResponse) }));
});

apiRoutes.route("/attachments", attachmentRoutes);

apiRoutes.route("/shares", shareRoutes);

apiRoutes.route("/shortcuts", shortcutRoutes);

function parseAttachmentIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "attachmentIds must be an array");
  }
  if (value.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }
  return value.map((entry) => {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry <= 0) {
      throw new HttpError(400, "bad_request", "attachmentIds must contain positive integers");
    }
    return entry;
  });
}

function parseAttachmentNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "names must be an array");
  }
  if (value.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }
  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new HttpError(400, "bad_request", "names must contain strings");
    }
    return parseAttachmentName(entry);
  });
}

function parseUsernames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "usernames must be an array");
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new HttpError(400, "bad_request", "usernames must contain strings");
    }
    return entry.trim();
  });
}
