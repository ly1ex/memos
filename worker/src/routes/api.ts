import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { readJsonObject } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth } from "../middleware/auth";
import { scheduleR2Delete } from "../r2/delete";
import { deleteAttachmentsByIds } from "../repositories/attachments";
import { toAttachmentResponse } from "../serializers/attachments";
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
  return c.json(ok({ user: auth.localUser }));
});

apiRoutes.route("/instance", instanceRoutes);

apiRoutes.route("/users", userRoutes);

apiRoutes.route("/memos", memoRoutes);

apiRoutes.post("/attachments:batchDelete", requireAuth, async (c) => {
  const body = await readJsonObject(c);
  const attachmentIds = parseAttachmentIds(body.attachmentIds);
  const attachments = await deleteAttachmentsByIds(c.env.DB, {
    ids: attachmentIds,
    creatorId: c.get("auth").localUser.id
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
