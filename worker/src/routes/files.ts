import { Hono } from "hono";

import { canReadMemo } from "../auth/memo-access";
import { canReadOwnedResource } from "../auth/permissions";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { resolveOptionalAuthContext } from "../middleware/auth";
import { getAttachmentObject } from "../r2/download";
import { getAttachmentByUid } from "../repositories/attachments";
import { getMemoById } from "../repositories/memos";

export const fileRoutes = new Hono<AppEnv>();

fileRoutes.get("/attachments/:uid/:filename", async (c) => {
  const uid = c.req.param("uid");
  const filename = c.req.param("filename");
  const attachment = await getAttachmentByUid(c.env.DB, uid);
  if (!attachment || attachment.filename !== filename) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  const auth = await resolveOptionalAuthContext(c);
  if (attachment.memoId !== undefined) {
    const memo = await getMemoById(c.env.DB, attachment.memoId);
    if (!memo || memo.rowStatus !== "NORMAL") {
      throw new HttpError(404, "not_found", "Attachment not found");
    }

    if (!canReadMemo(auth, memo)) {
      throw new HttpError(auth ? 403 : 401, auth ? "permission_denied" : "unauthenticated", auth ? "Permission denied" : "Authentication required");
    }
  } else if (!auth || !canReadOwnedResource(auth.localUser, attachment.creatorId)) {
    throw new HttpError(auth ? 403 : 401, auth ? "permission_denied" : "unauthenticated", auth ? "Permission denied" : "Authentication required");
  }

  const response = await getAttachmentObject(c.env.ATTACHMENTS, attachment, c.req.raw.headers);
  if (!response) {
    throw new HttpError(404, "not_found", "Attachment object not found");
  }

  return response;
});
