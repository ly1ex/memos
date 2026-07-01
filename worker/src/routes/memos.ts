import { Hono } from "hono";
import type { Context } from "hono";

import { canReadMemo, canWriteMemo } from "../auth/memo-access";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { intPathParam, optionalBoolean, optionalString, readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth, resolveOptionalAuthContext } from "../middleware/auth";
import { listAttachments, setMemoAttachments } from "../repositories/attachments";
import { clampPageSize } from "../repositories/cursor";
import { createMemoRelation, listMemoComments } from "../repositories/memo-relations";
import { createMemoShare, deleteMemoShare, getMemoShareByShareId, listMemoShares } from "../repositories/memo-shares";
import { archiveMemo, createMemo, getMemoById, listMemos, parseMemoVisibility, updateMemo } from "../repositories/memos";
import { deleteMemoReaction, listMemoReactions, upsertMemoReaction } from "../repositories/reactions";
import { toAttachmentResponse } from "../serializers/attachments";
import { toMemoShareResponse } from "../serializers/shares";

export const memoRoutes = new Hono<AppEnv>();

memoRoutes.get("/", requireAuth, async (c) => {
  const auth = c.get("auth");
  const pageSize = clampPageSize(c.req.query("pageSize") ?? null);
  const page = await listMemos(c.env.DB, {
    creatorId: auth.localUser.id,
    pageSize,
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      memos: page.items,
      nextCursor: page.nextCursor
    })
  );
});

memoRoutes.post("/", requireAuth, async (c) => {
  const auth = c.get("auth");
  const body = await readJsonObject(c);
  const memo = await createMemo(c.env.DB, {
    creatorId: auth.localUser.id,
    content: requiredString(body, "content"),
    visibility: parseMemoVisibility(body.visibility, "PRIVATE")
  });

  return c.json(ok({ memo }), 201);
});

memoRoutes.get("/:id/comments", async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  const page = await listMemoComments(c.env.DB, {
    memoId: memo.id,
    pageSize: clampPageSize(c.req.query("pageSize") ?? null, 20, 100),
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      comments: page.items,
      nextCursor: page.nextCursor
    })
  );
});

memoRoutes.post("/:id/comments", requireAuth, async (c) => {
  const parent = await requireReadableMemo(c, intPathParam(c, "id"));
  const auth = c.get("auth");
  const body = await readJsonObject(c);
  const comment = await createMemo(c.env.DB, {
    creatorId: auth.localUser.id,
    content: requiredString(body, "content"),
    visibility: parent.visibility
  });
  await createMemoRelation(c.env.DB, {
    memoId: parent.id,
    relatedMemoId: comment.id,
    type: "COMMENT"
  });

  return c.json(ok({ comment }), 201);
});

memoRoutes.get("/:id/reactions", async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  const reactions = await listMemoReactions(c.env.DB, memo.id);

  return c.json(ok({ reactions }));
});

memoRoutes.put("/:id/reactions/:reactionType", requireAuth, async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  const reactionType = parseReactionType(c.req.param("reactionType"));
  const reaction = await upsertMemoReaction(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    type: reactionType
  });

  return c.json(ok({ reaction }));
});

memoRoutes.delete("/:id/reactions/:reactionType", requireAuth, async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  const reactionType = parseReactionType(c.req.param("reactionType"));
  const reaction = await deleteMemoReaction(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    type: reactionType
  });

  return c.json(ok({ reaction }));
});

memoRoutes.get("/:id/shares", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, intPathParam(c, "id"));
  const shares = await listMemoShares(c.env.DB, memo.id);

  return c.json(
    ok({
      shares: shares.map(toMemoShareResponse)
    })
  );
});

memoRoutes.post("/:id/shares", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, intPathParam(c, "id"));
  const body: Record<string, unknown> = await readJsonObject(c).catch(() => ({}));
  const share = await createMemoShare(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    expiresTs: parseOptionalExpiresTs(body.expiresTs)
  });

  return c.json(ok({ share: toMemoShareResponse(share) }), 201);
});

memoRoutes.delete("/:id/shares/:shareId", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, intPathParam(c, "id"));
  const share = await getMemoShareByShareId(c.env.DB, c.req.param("shareId"));
  if (!share || share.memoId !== memo.id) {
    throw new HttpError(404, "not_found", "Share not found");
  }

  const deleted = await deleteMemoShare(c.env.DB, share.shareId);
  if (!deleted) {
    throw new HttpError(404, "not_found", "Share not found");
  }

  return c.json(ok({ share: toMemoShareResponse(deleted) }));
});

memoRoutes.get("/:id/attachments", async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  const page = await listAttachments(c.env.DB, {
    memoId: memo.id,
    pageSize: clampPageSize(c.req.query("pageSize") ?? null, 50, 100),
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      attachments: page.items.map(toAttachmentResponse),
      nextCursor: page.nextCursor
    })
  );
});

memoRoutes.put("/:id/attachments", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, intPathParam(c, "id"));
  const body = await readJsonObject(c);
  const attachmentIds = parseAttachmentIds(body.attachmentIds);
  const attachments = await setMemoAttachments(c.env.DB, {
    memoId: memo.id,
    creatorId: memo.creatorId,
    attachmentIds
  });

  return c.json(
    ok({
      attachments: attachments.map(toAttachmentResponse)
    })
  );
});

memoRoutes.get("/:id", async (c) => {
  const memo = await requireReadableMemo(c, intPathParam(c, "id"));
  return c.json(ok({ memo }));
});

memoRoutes.patch("/:id", requireAuth, async (c) => {
  const id = intPathParam(c, "id");
  await requireWritableMemo(c, id);

  const body = await readJsonObject(c);
  const memo = await updateMemo(c.env.DB, id, {
    content: optionalString(body, "content"),
    visibility: body.visibility === undefined ? undefined : parseMemoVisibility(body.visibility, "PRIVATE"),
    pinned: optionalBoolean(body, "pinned")
  });

  if (!memo) {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  return c.json(ok({ memo }));
});

memoRoutes.delete("/:id", requireAuth, async (c) => {
  const id = intPathParam(c, "id");
  await requireWritableMemo(c, id);

  const memo = await archiveMemo(c.env.DB, id);
  if (!memo) {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  return c.json(ok({ memo }));
});

async function requireReadableMemo(c: Context<AppEnv>, id: number) {
  const memo = await getMemoById(c.env.DB, id);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  const auth = await resolveOptionalAuthContext(c);
  if (!canReadMemo(auth, memo)) {
    throw new HttpError(auth ? 403 : 401, auth ? "permission_denied" : "unauthenticated", auth ? "Permission denied" : "Authentication required");
  }

  return memo;
}

async function requireWritableMemo(c: Context<AppEnv>, id: number) {
  const memo = await getMemoById(c.env.DB, id);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  if (!canWriteMemo(c.get("auth"), memo)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }

  return memo;
}

function parseAttachmentIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "attachmentIds must be an array");
  }

  const attachmentIds = value.map((entry) => {
    if (!Number.isInteger(entry) || entry <= 0) {
      throw new HttpError(400, "bad_request", "attachmentIds must contain positive integers");
    }
    return entry;
  });

  if (attachmentIds.length > 50) {
    throw new HttpError(400, "bad_request", "Too many attachments");
  }

  return attachmentIds;
}

function parseOptionalExpiresTs(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "bad_request", "Invalid share expiration");
  }
  return value;
}

function parseReactionType(value: string): string {
  if (!/^[A-Za-z0-9_+-]{1,64}$/.test(value)) {
    throw new HttpError(400, "bad_request", "Invalid reaction type");
  }
  return value;
}
