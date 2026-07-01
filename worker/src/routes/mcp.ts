import { Hono } from "hono";
import type { Context } from "hono";

import { canReadMemo, canWriteMemo } from "../auth/memo-access";
import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { resolveOptionalAuthContext } from "../middleware/auth";
import { scheduleR2Delete } from "../r2/delete";
import { listAttachments, setMemoAttachments, getAttachmentById, deleteAttachmentMetadata } from "../repositories/attachments";
import { clampPageSize } from "../repositories/cursor";
import { createMemoRelation, listMemoComments, listMemoRelations, setMemoRelations } from "../repositories/memo-relations";
import { archiveMemo, createMemo, getMemoById, listMemos, parseMemoVisibility, updateMemo } from "../repositories/memos";
import { deleteMemoReaction, listMemoReactions, upsertMemoReaction } from "../repositories/reactions";
import { toAttachmentResponse } from "../serializers/attachments";

export const mcpRoutes = new Hono<AppEnv>();

const tools = [
  "list_memos",
  "get_memo",
  "create_memo",
  "update_memo",
  "delete_memo",
  "list_memo_comments",
  "create_memo_comment",
  "list_memo_attachments",
  "set_memo_attachments",
  "list_memo_reactions",
  "upsert_memo_reaction",
  "delete_memo_reaction",
  "list_memo_relations",
  "set_memo_relations",
  "list_attachments",
  "get_attachment",
  "delete_attachment"
].map((name) => ({
  name,
  description: `Memos ${name.replaceAll("_", " ")} tool.`,
  inputSchema: {
    type: "object",
    additionalProperties: true
  }
}));

mcpRoutes.post("/", async (c) => {
  const body = await c.req.json<JsonRpcRequest>().catch(() => null);
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return c.json(jsonRpcError(null, -32600, "Invalid Request"), 400);
  }

  switch (body.method) {
    case "initialize":
      return c.json({
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "memos-cloudflare-worker",
            version: "0.1.0"
          }
        }
      });
    case "tools/list":
      return c.json({
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          tools
        }
      });
    case "tools/call":
      try {
        const result = await callTool(c, body.params);
        return c.json({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return c.json(jsonRpcError(body.id ?? null, -32000, error.message), error.status as never);
        }
        throw error;
      }
    default:
      return c.json(jsonRpcError(body.id ?? null, -32601, "Method not found"), 404);
  }
});

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

async function callTool(c: Context<AppEnv>, params: unknown) {
  const toolCall = parseToolCall(params);
  const auth = await resolveOptionalAuthContext(c);
  if (!auth) {
    throw new HttpError(401, "unauthenticated", "Authentication required");
  }

  const args = toolCall.arguments;
  switch (toolCall.name) {
    case "list_memos": {
      const page = await listMemos(c.env.DB, {
        creatorId: auth.localUser.id,
        pageSize: clampPageSize(readOptionalString(args, "pageSize"), 20, 100),
        cursor: readOptionalString(args, "cursor")
      });
      return toolResult({ memos: page.items, nextCursor: page.nextCursor });
    }
    case "get_memo": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      return toolResult({ memo });
    }
    case "create_memo": {
      const memo = await createMemo(c.env.DB, {
        creatorId: auth.localUser.id,
        content: readRequiredString(args, "content"),
        visibility: parseMemoVisibility(args.visibility, "PRIVATE")
      });
      return toolResult({ memo });
    }
    case "update_memo": {
      const memo = await requireWritableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const updated = await updateMemo(c.env.DB, memo.id, {
        content: readOptionalString(args, "content") ?? undefined,
        visibility: args.visibility === undefined ? undefined : parseMemoVisibility(args.visibility, "PRIVATE"),
        pinned: readOptionalBoolean(args, "pinned")
      });
      return toolResult({ memo: updated });
    }
    case "delete_memo": {
      const memo = await requireWritableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const deleted = await archiveMemo(c.env.DB, memo.id);
      return toolResult({ memo: deleted });
    }
    case "list_memo_comments": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const page = await listMemoComments(c.env.DB, {
        memoId: memo.id,
        pageSize: clampPageSize(readOptionalString(args, "pageSize"), 20, 100),
        cursor: readOptionalString(args, "cursor")
      });
      return toolResult({ comments: page.items, nextCursor: page.nextCursor });
    }
    case "create_memo_comment": {
      const parent = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const comment = await createMemo(c.env.DB, {
        creatorId: auth.localUser.id,
        content: readRequiredString(args, "content"),
        visibility: parent.visibility
      });
      await createMemoRelation(c.env.DB, {
        memoId: parent.id,
        relatedMemoId: comment.id,
        type: "COMMENT"
      });
      return toolResult({ comment });
    }
    case "list_memo_attachments": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const page = await listAttachments(c.env.DB, {
        memoId: memo.id,
        pageSize: clampPageSize(readOptionalString(args, "pageSize"), 50, 100),
        cursor: readOptionalString(args, "cursor")
      });
      return toolResult({ attachments: page.items.map(toAttachmentResponse), nextCursor: page.nextCursor });
    }
    case "set_memo_attachments": {
      const memo = await requireWritableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const attachments = await setMemoAttachments(c.env.DB, {
        memoId: memo.id,
        creatorId: memo.creatorId,
        attachmentIds: readPositiveIntegerArray(args, "attachmentIds")
      });
      return toolResult({ attachments: attachments.map(toAttachmentResponse) });
    }
    case "list_memo_reactions": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      return toolResult({ reactions: await listMemoReactions(c.env.DB, memo.id) });
    }
    case "list_memo_relations": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      return toolResult({ relations: await listMemoRelations(c.env.DB, memo.id) });
    }
    case "set_memo_relations": {
      const memo = await requireWritableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const relations = await setMemoRelations(c.env.DB, {
        memoId: memo.id,
        relations: readRelationArray(args, "relations")
      });
      return toolResult({ relations });
    }
    case "upsert_memo_reaction": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const reaction = await upsertMemoReaction(c.env.DB, {
        memoId: memo.id,
        creatorId: auth.localUser.id,
        type: readRequiredString(args, "reactionType")
      });
      return toolResult({ reaction });
    }
    case "delete_memo_reaction": {
      const memo = await requireReadableMemoForTool(c, readRequiredPositiveInteger(args, "id"));
      const reaction = await deleteMemoReaction(c.env.DB, {
        memoId: memo.id,
        creatorId: auth.localUser.id,
        type: readRequiredString(args, "reactionType")
      });
      return toolResult({ reaction });
    }
    case "list_attachments": {
      const page = await listAttachments(c.env.DB, {
        creatorId: auth.localUser.id,
        pageSize: clampPageSize(readOptionalString(args, "pageSize"), 20, 100),
        cursor: readOptionalString(args, "cursor")
      });
      return toolResult({ attachments: page.items.map(toAttachmentResponse), nextCursor: page.nextCursor });
    }
    case "get_attachment": {
      const attachment = await getAttachmentById(c.env.DB, readRequiredPositiveInteger(args, "id"));
      if (!attachment || attachment.creatorId !== auth.localUser.id) {
        throw new HttpError(404, "not_found", "Attachment not found");
      }
      return toolResult({ attachment: toAttachmentResponse(attachment) });
    }
    case "delete_attachment": {
      const attachment = await getAttachmentById(c.env.DB, readRequiredPositiveInteger(args, "id"));
      if (!attachment || attachment.creatorId !== auth.localUser.id) {
        throw new HttpError(404, "not_found", "Attachment not found");
      }
      const deleted = await deleteAttachmentMetadata(c.env.DB, attachment.id);
      if (deleted) {
        scheduleR2Delete(c, deleted.r2Key);
      }
      return toolResult({ attachment: deleted ? toAttachmentResponse(deleted) : null });
    }
    default:
      throw new HttpError(404, "not_found", `Unknown MCP tool: ${toolCall.name}`);
  }
}

function parseToolCall(params: unknown): { name: string; arguments: Record<string, unknown> } {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new HttpError(400, "bad_request", "Invalid tools/call params");
  }
  const record = params as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim() === "") {
    throw new HttpError(400, "bad_request", "Missing MCP tool name");
  }
  const args = record.arguments;
  if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
    throw new HttpError(400, "bad_request", "MCP tool arguments must be an object");
  }
  return {
    name: record.name,
    arguments: (args ?? {}) as Record<string, unknown>
  };
}

async function requireReadableMemoForTool(c: Context<AppEnv>, id: number) {
  const auth = await resolveOptionalAuthContext(c);
  const memo = await getMemoById(c.env.DB, id);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }
  if (!canReadMemo(auth, memo)) {
    throw new HttpError(auth ? 403 : 401, auth ? "permission_denied" : "unauthenticated", auth ? "Permission denied" : "Authentication required");
  }
  return memo;
}

async function requireWritableMemoForTool(c: Context<AppEnv>, id: number) {
  const auth = await resolveOptionalAuthContext(c);
  if (!auth) {
    throw new HttpError(401, "unauthenticated", "Authentication required");
  }
  const memo = await getMemoById(c.env.DB, id);
  if (!memo || memo.rowStatus !== "NORMAL") {
    throw new HttpError(404, "not_found", "Memo not found");
  }
  if (!canWriteMemo(auth, memo)) {
    throw new HttpError(403, "permission_denied", "Permission denied");
  }
  return memo;
}

function readRequiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "bad_request", `Missing required string argument: ${key}`);
  }
  return value;
}

function readOptionalString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return String(value);
  }
  return value;
}

function readOptionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, "bad_request", `Invalid boolean argument: ${key}`);
  }
  return value;
}

function readRequiredPositiveInteger(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "bad_request", `Invalid positive integer argument: ${key}`);
  }
  return value;
}

function readPositiveIntegerArray(args: Record<string, unknown>, key: string): number[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", `Invalid integer array argument: ${key}`);
  }
  return value.map((entry) => {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry <= 0) {
      throw new HttpError(400, "bad_request", `Invalid integer array argument: ${key}`);
    }
    return entry;
  });
}

function readRelationArray(args: Record<string, unknown>, key: string): Array<{ relatedMemoId: number; type: string }> {
  const value = args[key];
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", `Invalid relation array argument: ${key}`);
  }
  if (value.length > 50) {
    throw new HttpError(400, "bad_request", "Too many relations");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new HttpError(400, "bad_request", `Invalid relation array argument: ${key}`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.relatedMemoId !== "number" || !Number.isInteger(record.relatedMemoId) || record.relatedMemoId <= 0) {
      throw new HttpError(400, "bad_request", "Invalid relatedMemoId");
    }
    if (typeof record.type !== "string" || !/^[A-Z_]{1,64}$/.test(record.type)) {
      throw new HttpError(400, "bad_request", "Invalid relation type");
    }
    return {
      relatedMemoId: record.relatedMemoId,
      type: record.type
    };
  });
}

function toolResult(data: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data
  };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}
