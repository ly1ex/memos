import { Hono } from "hono";
import type { Context } from "hono";

import { canReadMemo, canWriteMemo } from "../auth/memo-access";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { optionalBoolean, optionalString, readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAuth, resolveOptionalAuthContext } from "../middleware/auth";
import { listAttachments, setMemoAttachments } from "../repositories/attachments";
import { clampPageSize } from "../repositories/cursor";
import { createMemoRelation, listMemoComments, listMemoRelations, setMemoRelations } from "../repositories/memo-relations";
import { createMemoShare, deleteMemoShare, getMemoShareByShareId, listMemoShares } from "../repositories/memo-shares";
import { archiveMemo, createMemo, getMemoById, getMemoByUid, listVisibleMemos, parseMemoVisibility, updateMemo } from "../repositories/memos";
import { deleteMemoReaction, listMemoReactions, upsertMemoReaction } from "../repositories/reactions";
import { toAttachmentResponse } from "../serializers/attachments";
import { toMemoResponse } from "../serializers/memos";
import { toMemoShareResponse } from "../serializers/shares";
import { parseMemoName, parseResourceIdOrName } from "../utils/resource-names";

export const memoRoutes = new Hono<AppEnv>();

memoRoutes.get("/", async (c) => {
  const auth = await resolveOptionalAuthContext(c);
  const pageSize = clampPageSize(c.req.query("pageSize") ?? null);
  const page = await listVisibleMemos(c.env.DB, {
    viewerId: auth?.localUser.id,
    pageSize,
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      memos: page.items.map((memo) => toMemoResponse(memo)),
      nextCursor: page.nextCursor
    })
  );
});

memoRoutes.post("/", requireAuth, async (c) => {
  const auth = c.get("auth");
  const body = await readJsonObject(c);
  const memoBody = typeof body.memo === "object" && body.memo !== null && !Array.isArray(body.memo) ? (body.memo as Record<string, unknown>) : body;
  const memo = await createMemo(c.env.DB, {
    uid: optionalString(body, "memoId") ?? optionalString(body, "memo_id"),
    creatorId: auth.localUser.id,
    content: requiredString(memoBody, "content"),
    visibility: parseMemoVisibility(memoBody.visibility, "PRIVATE")
  });

  return c.json(ok({ memo: toMemoResponse(memo) }), 201);
});

memoRoutes.get("/-/linkMetadata", async (c) => {
  const url = c.req.query("url") ?? "";
  const metadata = await getLinkMetadata(url);
  return c.json(ok({ metadata, linkMetadata: metadata }));
});

memoRoutes.post("/-/linkMetadata:batchGet", async (c) => {
  const body = await readJsonObject(c);
  if (!Array.isArray(body.urls)) {
    throw new HttpError(400, "bad_request", "urls must be an array");
  }
  if (body.urls.length > 10) {
    throw new HttpError(400, "bad_request", "Too many urls");
  }
  const linkMetadata = await Promise.all(body.urls.map((url) => getLinkMetadata(typeof url === "string" ? url : "")));
  return c.json(ok({ linkMetadata }));
});

memoRoutes.get("/:id/comments", async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const page = await listMemoComments(c.env.DB, {
    memoId: memo.id,
    pageSize: clampPageSize(c.req.query("pageSize") ?? null, 20, 100),
    cursor: c.req.query("cursor") ?? null
  });

  return c.json(
    ok({
      comments: page.items.map((comment) => toMemoResponse(comment)),
      nextCursor: page.nextCursor
    })
  );
});

memoRoutes.post("/:id/comments", requireAuth, async (c) => {
  const parent = await requireReadableMemo(c, c.req.param("id"));
  const auth = c.get("auth");
  const body = await readJsonObject(c);
  const content = typeof body.comment === "object" && body.comment !== null && !Array.isArray(body.comment)
    ? requiredString(body.comment as Record<string, unknown>, "content")
    : requiredString(body, "content");
  const comment = await createMemo(c.env.DB, {
    creatorId: auth.localUser.id,
    content,
    visibility: parent.visibility
  });
  await createMemoRelation(c.env.DB, {
    memoId: parent.id,
    relatedMemoId: comment.id,
    type: "COMMENT"
  });

  return c.json(ok({ comment: toMemoResponse(comment), memo: toMemoResponse(comment) }), 201);
});

memoRoutes.get("/:id/reactions", async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const reactions = await listMemoReactions(c.env.DB, memo.id);

  return c.json(ok({ reactions }));
});

memoRoutes.put("/:id/reactions/:reactionType", requireAuth, async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const reactionType = parseReactionType(c.req.param("reactionType"));
  const reaction = await upsertMemoReaction(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    type: reactionType
  });

  return c.json(ok({ reaction }));
});

memoRoutes.post("/:id/reactions", requireAuth, async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const body = await readJsonObject(c);
  const reactionType = requiredString(body, "type");
  const reaction = await upsertMemoReaction(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    type: parseReactionType(reactionType)
  });

  return c.json(ok({ reaction }));
});

memoRoutes.delete("/:id/reactions/:reactionType", requireAuth, async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const reactionType = parseReactionType(c.req.param("reactionType"));
  const reaction = await deleteMemoReaction(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    type: reactionType
  });

  return c.json(ok({ reaction }));
});

memoRoutes.get("/:id/shares", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, c.req.param("id"));
  const shares = await listMemoShares(c.env.DB, memo.id);

  return c.json(
    ok({
      shares: shares.map(toMemoShareResponse)
    })
  );
});

memoRoutes.post("/:id/shares", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, c.req.param("id"));
  const body: Record<string, unknown> = await readJsonObject(c).catch(() => ({}));
  const share = await createMemoShare(c.env.DB, {
    memoId: memo.id,
    creatorId: c.get("auth").localUser.id,
    expiresTs: parseOptionalExpiresTs(body.expiresTs)
  });

  return c.json(ok({ share: toMemoShareResponse(share) }), 201);
});

memoRoutes.delete("/:id/shares/:shareId", requireAuth, async (c) => {
  const memo = await requireWritableMemo(c, c.req.param("id"));
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
  const memo = await requireReadableMemo(c, c.req.param("id"));
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

memoRoutes.patch("/:id/attachments", requireAuth, setMemoAttachmentsHandler);
memoRoutes.put("/:id/attachments", requireAuth, setMemoAttachmentsHandler);

memoRoutes.get("/:id/relations", async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const auth = await resolveOptionalAuthContext(c);
  const relations = await listMemoRelations(c.env.DB, memo.id);
  const visibleRelations = [];
  for (const relation of relations) {
    const relatedMemo = await getMemoById(c.env.DB, relation.relatedMemoId);
    if (relatedMemo && relatedMemo.rowStatus === "NORMAL" && canReadMemo(auth, relatedMemo)) {
      visibleRelations.push(relation);
    }
  }
  return c.json(ok({ relations: visibleRelations }));
});

memoRoutes.patch("/:id/relations", requireAuth, setMemoRelationsHandler);
memoRoutes.put("/:id/relations", requireAuth, setMemoRelationsHandler);

memoRoutes.get("/:id", async (c) => {
  const memo = await requireReadableMemo(c, c.req.param("id"));
  const reactions = await listMemoReactions(c.env.DB, memo.id);
  return c.json(ok({ memo: toMemoResponse(memo, reactions) }));
});

memoRoutes.patch("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  await requireWritableMemo(c, id);

  const body = await readJsonObject(c);
  const memoBody = typeof body.memo === "object" && body.memo !== null && !Array.isArray(body.memo) ? (body.memo as Record<string, unknown>) : body;
  const memo = await updateMemo(c.env.DB, await memoNumericId(c.env.DB, id), {
    content: optionalString(memoBody, "content"),
    visibility: memoBody.visibility === undefined ? undefined : parseMemoVisibility(memoBody.visibility, "PRIVATE"),
    pinned: optionalBoolean(memoBody, "pinned")
  });

  if (!memo) {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  return c.json(ok({ memo: toMemoResponse(memo) }));
});

memoRoutes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  await requireWritableMemo(c, id);

  const memo = await archiveMemo(c.env.DB, await memoNumericId(c.env.DB, id));
  if (!memo) {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  return c.json(ok({ memo: toMemoResponse(memo) }));
});

async function setMemoAttachmentsHandler(c: Context<AppEnv>) {
  const memo = await requireWritableMemo(c, requiredPathParam(c, "id"));
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
}

async function setMemoRelationsHandler(c: Context<AppEnv>) {
  const memo = await requireWritableMemo(c, requiredPathParam(c, "id"));
  const body = await readJsonObject(c);
  const rawRelations = Array.isArray(body.relations) ? body.relations : [];
  const relationInputs = rawRelations.map(parseRelationInput);
  for (const relation of relationInputs) {
    const relatedMemo = await getMemoById(c.env.DB, relation.relatedMemoId);
    if (!relatedMemo || relatedMemo.rowStatus !== "NORMAL" || !canReadMemo(c.get("auth"), relatedMemo)) {
      throw new HttpError(404, "not_found", "Related memo not found");
    }
  }
  const relations = await setMemoRelations(c.env.DB, {
    memoId: memo.id,
    relations: relationInputs
  });
  return c.json(ok({ relations }));
}

function parseRelationInput(value: unknown): { relatedMemoId: number; type: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "Invalid relation");
  }
  const record = value as Record<string, unknown>;
  const relatedMemoId = record.relatedMemoId;
  if (typeof relatedMemoId !== "number" || !Number.isInteger(relatedMemoId) || relatedMemoId <= 0) {
    throw new HttpError(400, "bad_request", "Invalid relatedMemoId");
  }
  return {
    relatedMemoId,
    type: requiredString(record, "type")
  };
}

function requiredPathParam(c: Context<AppEnv>, key: string): string {
  const value = c.req.param(key);
  if (!value) {
    throw new HttpError(400, "bad_request", `Missing path parameter: ${key}`);
  }
  return value;
}

async function requireReadableMemo(c: Context<AppEnv>, idOrUid: string) {
  const memo = await getMemoByIdOrUid(c.env.DB, idOrUid);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  const auth = await resolveOptionalAuthContext(c);
  if (!canReadMemo(auth, memo)) {
    throw new HttpError(auth ? 403 : 401, auth ? "permission_denied" : "unauthenticated", auth ? "Permission denied" : "Authentication required");
  }

  return memo;
}

async function requireWritableMemo(c: Context<AppEnv>, idOrUid: string) {
  const memo = await getMemoByIdOrUid(c.env.DB, idOrUid);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }

  if (!canWriteMemo(c.get("auth"), memo)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }

  return memo;
}

async function memoNumericId(db: D1Database, idOrUid: string): Promise<number> {
  const memo = await getMemoByIdOrUid(db, idOrUid);
  if (!memo) {
    throw new HttpError(404, "not_found", "Memo not found");
  }
  return memo.id;
}

async function getMemoByIdOrUid(db: D1Database, idOrUid: string) {
  const parsed = parseResourceIdOrName(idOrUid, "memos", "memo name");
  if (/^\d+$/.test(parsed)) {
    const byId = await getMemoById(db, Number(parsed));
    if (byId) {
      return byId;
    }
  }
  return getMemoByUid(db, parseMemoName(parsed.startsWith("memos/") ? parsed : `memos/${parsed}`));
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

async function getLinkMetadata(inputUrl: string) {
  const url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpError(400, "bad_request", "url is required");
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Memos Cloudflare Worker"
    }
  });
  if (!response.ok) {
    throw new HttpError(400, "bad_request", "failed to fetch link metadata");
  }

  const html = await response.text();
  return {
    url: inputUrl,
    title: readHtmlMeta(html, "og:title") || readTitle(html),
    description: readHtmlMeta(html, "description") || readHtmlMeta(html, "og:description"),
    image: readHtmlMeta(html, "og:image")
  };
}

function readTitle(html: string): string {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function readHtmlMeta(html: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  return decodeHtml(html.match(pattern)?.[1] ?? "");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}
