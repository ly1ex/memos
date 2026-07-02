import { Hono } from "hono";
import type { Context } from "hono";

import { canReadOwnedResource, canWriteOwnedResource } from "../auth/permissions";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { optionalString, readJsonObject } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth } from "../middleware/auth";
import { scheduleR2Delete } from "../r2/delete";
import { getMemoById, getMemoByUid } from "../repositories/memos";
import {
  createAttachmentMetadata,
  deleteAttachmentMetadata,
  getAttachmentByIdOrUid,
  listAttachments,
  updateAttachmentMetadata
} from "../repositories/attachments";
import { clampPageSize } from "../repositories/cursor";
import { toAttachmentResponse } from "../serializers/attachments";
import { sanitizeFilename } from "../utils/filename";
import { parseResourceIdOrName } from "../utils/resource-names";
import { createUid } from "../utils/uid";

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.use("*", requireAuth);

attachmentRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const page = await listAttachments(c.env.DB, {
    creatorId: auth.localUser.id,
    pageSize: clampPageSize(c.req.query("pageSize") ?? null),
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      attachments: page.items.map(toAttachmentResponse),
      nextCursor: page.nextCursor
    })
  );
});

attachmentRoutes.post("/", async (c) => {
  const auth = c.get("auth");
  const formData = await c.req.formData().catch(() => null);
  if (!formData) {
    throw new HttpError(400, "bad_request", "Expected multipart form data");
  }

  const fileValue = formData.get("file");
  if (!isUploadedFile(fileValue)) {
    throw new HttpError(400, "bad_request", "Missing attachment file");
  }

  const memoId = parseOptionalMemoId(formData.get("memoId"));
  if (memoId !== undefined) {
    const memo = await getMemoById(c.env.DB, memoId);
    if (!memo || memo.rowStatus !== "NORMAL") {
      throw new HttpError(404, "not_found", "Memo not found");
    }
    if (!canWriteOwnedResource(auth.localUser, memo.creatorId)) {
      throw new HttpError(403, "permission_denied", "Permission denied");
    }
  }

  const requestedUid = parseOptionalAttachmentId(formData.get("attachmentId") ?? formData.get("attachment_id"));
  const uid = requestedUid ?? createUid("att");
  const filename = sanitizeFilename(fileValue.name);
  const contentType = fileValue.type || "application/octet-stream";
  const r2Key = `attachments/${uid}/${filename}`;

  await c.env.ATTACHMENTS.put(r2Key, fileValue.stream(), {
    httpMetadata: {
      contentType
    },
    customMetadata: {
      uid,
      filename,
      creatorId: String(auth.localUser.id)
    }
  });

  try {
    const attachment = await createAttachmentMetadata(c.env.DB, {
      uid,
      creatorId: auth.localUser.id,
      memoId,
      filename,
      type: contentType,
      size: fileValue.size,
      r2Key,
      metadata: {}
    });

    return c.json(ok({ attachment: toAttachmentResponse(attachment) }), 201);
  } catch (error) {
    scheduleR2Delete(c, r2Key);
    throw error;
  }
});

attachmentRoutes.get("/:id", async (c) => {
  const attachment = await requireReadableAttachment(c, c.req.param("id"));
  return c.json(ok({ attachment: toAttachmentResponse(attachment) }));
});

attachmentRoutes.patch("/:id", async (c) => {
  const attachment = await requireWritableAttachment(c, c.req.param("id"));

  const body = await readJsonObject(c);
  const attachmentBody = typeof body.attachment === "object" && body.attachment !== null && !Array.isArray(body.attachment)
    ? (body.attachment as Record<string, unknown>)
    : body;
  const memoId = await parseOptionalMemoIdFromJson(c.env.DB, attachmentBody.memoId ?? attachmentBody.memo);
  if (memoId !== undefined && memoId !== null) {
    const memo = await getMemoById(c.env.DB, memoId);
    if (!memo || memo.rowStatus !== "NORMAL") {
      throw new HttpError(404, "not_found", "Memo not found");
    }
    if (!canWriteOwnedResource(c.get("auth").localUser, memo.creatorId)) {
      throw new HttpError(403, "permission_denied", "Permission denied");
    }
  }

  const updated = await updateAttachmentMetadata(c.env.DB, {
    id: attachment.id,
    creatorId: c.get("auth").localUser.id,
    filename: optionalString(attachmentBody, "filename"),
    type: optionalString(attachmentBody, "type"),
    metadata: attachmentBody.metadata,
    memoId
  });

  if (!updated) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  return c.json(ok({ attachment: toAttachmentResponse(updated) }));
});

attachmentRoutes.delete("/:id", async (c) => {
  const attachment = await requireWritableAttachment(c, c.req.param("id"));

  const deleted = await deleteAttachmentMetadata(c.env.DB, attachment.id);
  if (!deleted) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  scheduleR2Delete(c, deleted.r2Key);
  return c.json(ok({ attachment: toAttachmentResponse(deleted) }));
});

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  stream(): ReadableStream;
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "size" in value &&
    "stream" in value &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.stream === "function"
  );
}

function parseOptionalMemoId(value: unknown): number | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "bad_request", "Invalid memoId");
  }

  const memoId = Number.parseInt(value, 10);
  if (!Number.isInteger(memoId) || memoId <= 0) {
    throw new HttpError(400, "bad_request", "Invalid memoId");
  }
  return memoId;
}

function parseOptionalAttachmentId(value: unknown): string | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new HttpError(400, "bad_request", "Invalid attachmentId");
  }
  return value;
}

async function parseOptionalMemoIdFromJson(db: D1Database, value: unknown): Promise<number | null | undefined> {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    const memoUid = parseResourceIdOrName(value, "memos", "memo name");
    const memo = /^\d+$/.test(memoUid) ? (await getMemoById(db, Number(memoUid))) ?? (await getMemoByUid(db, memoUid)) : await getMemoByUid(db, memoUid);
    if (!memo) {
      throw new HttpError(404, "not_found", "Memo not found");
    }
    return memo.id;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "bad_request", "Invalid memoId");
  }
  return value;
}

async function requireReadableAttachment(c: Context<AppEnv>, idOrUid: string) {
  const attachment = await getAttachmentByIdOrUid(c.env.DB, parseResourceIdOrName(idOrUid, "attachments", "attachment name"));
  if (!attachment) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  if (!canReadOwnedResource(c.get("auth").localUser, attachment.creatorId)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }

  return attachment;
}

async function requireWritableAttachment(c: Context<AppEnv>, idOrUid: string) {
  const attachment = await getAttachmentByIdOrUid(c.env.DB, parseResourceIdOrName(idOrUid, "attachments", "attachment name"));
  if (!attachment) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }

  if (!canWriteOwnedResource(c.get("auth").localUser, attachment.creatorId)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }

  return attachment;
}
