import { ApiError, ApiErrorCode } from "@/api/errors";
import {
  type Attachment,
  AttachmentSchema,
  createMessage,
  type InstanceProfile,
  InstanceProfileSchema,
  type InstanceSetting,
  InstanceSettingSchema,
  type LinkMetadata,
  LinkMetadataSchema,
  type Memo,
  type MemoEntryType,
  type MemoRelation,
  MemoRelation_MemoSchema,
  MemoRelation_Type,
  MemoRelationSchema,
  MemoSchema,
  type MemoShare,
  MemoShareSchema,
  type MemoSpace,
  MotionMediaSchema,
  type Reaction,
  ReactionSchema,
  type Shortcut,
  ShortcutSchema,
  State,
  timestampFromDate,
  type User,
  User_Role,
  type UserNotification,
  UserSchema,
  type UserSetting,
  UserSetting_Key,
  UserSettingSchema,
  UserStatsSchema,
  type UserWebhook,
  Visibility,
} from "@/api/types";
import { clearAccessToken } from "@/auth-state";
import { getClerkRequestToken, signOutClerkSession } from "@/clerk-auth";
import { redirectOnAuthFailure } from "@/utils/auth-redirect";

type JsonObject = Record<string, unknown>;

interface ApiSuccess<T> {
  data: T;
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
}

export async function refreshAccessToken(): Promise<void> {
  await getClerkRequestToken();
}

export async function getRequestToken(): Promise<string | null> {
  return getClerkRequestToken();
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers();
  const token = await getRequestToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body, jsonReplacer);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
  });

  const text = await response.text();
  const payload = text ? parseJson(text) : {};

  if (!response.ok) {
    const failure = payload as ApiFailure;
    const message = failure.error?.message || response.statusText || "Request failed";
    const error = new ApiError(message, codeFromHttpError(response.status, failure.error?.code), response.status);
    if (error.code === ApiErrorCode.Unauthenticated) {
      clearAccessToken();
    }
    throw error;
  }

  if (isRecord(payload) && "data" in payload) {
    return (payload as unknown as ApiSuccess<T>).data;
  }
  return payload as T;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function codeFromHttpError(status: number, code?: string): ApiErrorCode {
  if (status === 401 || code === "unauthenticated") return ApiErrorCode.Unauthenticated;
  if (status === 403 || code === "permission_denied") return ApiErrorCode.PermissionDenied;
  if (status === 404 || code === "not_found") return ApiErrorCode.NotFound;
  if (status === 400 || code === "bad_request") return ApiErrorCode.InvalidArgument;
  if (status === 501 || code === "not_implemented") return ApiErrorCode.Unimplemented;
  return ApiErrorCode.Internal;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  return value;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asBigInt(value: unknown, fallback = 0n): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return fallback;
}

function timestampFrom(value: unknown) {
  if (!value) return undefined;
  if (isRecord(value) && ("seconds" in value || "nanos" in value)) {
    return {
      seconds: asBigInt(value.seconds),
      nanos: asNumber(value.nanos),
    };
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return timestampFromDate(date);
    }
  }
  return undefined;
}

function stateFrom(value: unknown): State {
  if (typeof value === "number") return value as State;
  if (value === "NORMAL") return State.NORMAL;
  if (value === "ARCHIVED") return State.ARCHIVED;
  return State.NORMAL;
}

function stateName(value: unknown): "NORMAL" | "ARCHIVED" | undefined {
  const state = stateFrom(value);
  if (state === State.NORMAL) return "NORMAL";
  if (state === State.ARCHIVED) return "ARCHIVED";
  return undefined;
}

function visibilityFrom(value: unknown): Visibility {
  if (typeof value === "number") return value as Visibility;
  if (value === "PUBLIC") return Visibility.PUBLIC;
  if (value === "PROTECTED") return Visibility.PROTECTED;
  if (value === "PRIVATE") return Visibility.PRIVATE;
  return Visibility.PRIVATE;
}

function visibilityName(value: unknown): "PRIVATE" | "PROTECTED" | "PUBLIC" | undefined {
  const visibility = visibilityFrom(value);
  if (visibility === Visibility.PRIVATE) return "PRIVATE";
  if (visibility === Visibility.PROTECTED) return "PROTECTED";
  if (visibility === Visibility.PUBLIC) return "PUBLIC";
  return undefined;
}

function memoEntryTypeFrom(value: unknown): MemoEntryType {
  if (value === "DIARY" || value === "COMMUNITY") return value;
  return "MEMO";
}

function memoSpaceName(value: unknown): MemoSpace | undefined {
  return value === "private" || value === "community" ? value : undefined;
}

function userRoleFrom(value: unknown): User_Role {
  if (typeof value === "number") return value as User_Role;
  if (value === "ADMIN") return User_Role.ADMIN;
  if (value === "USER") return User_Role.USER;
  return User_Role.USER;
}

function userRoleName(value: unknown): "ADMIN" | "USER" | undefined {
  const role = userRoleFrom(value);
  if (role === User_Role.ADMIN) return "ADMIN";
  if (role === User_Role.USER) return "USER";
  return undefined;
}

function resourceId(name: string, prefix: string): string {
  return name.startsWith(`${prefix}/`) ? name.slice(prefix.length + 1) : name;
}

function resourcePath(name: string, prefix: string): string {
  return encodeURIComponent(resourceId(name, prefix));
}

function shortcutPath(name: string): { username: string; shortcutId: string } {
  const parts = name.split("/");
  return {
    username: parts[1] ?? "",
    shortcutId: parts[3] ?? "",
  };
}

function normalizeUser(raw: unknown): User {
  const record = isRecord(raw) ? raw : {};
  return createMessage(UserSchema, {
    clerkUserId: asString(record.clerkUserId),
    name: asString(record.name) || `users/${asString(record.username)}`,
    role: userRoleFrom(record.role),
    username: asString(record.username) || resourceId(asString(record.name), "users"),
    displayUsername: asString(record.displayUsername),
    email: asString(record.email),
    displayName: asString(record.displayName) || asString(record.nickname),
    avatarUrl: asString(record.avatarUrl),
    description: asString(record.description),
    state: stateFrom(record.state ?? record.rowStatus),
    createTime: timestampFrom(record.createTime ?? record.createdTs),
    updateTime: timestampFrom(record.updateTime ?? record.updatedTs),
  });
}

function normalizeAttachment(raw: unknown): Attachment {
  const record = isRecord(raw) ? raw : {};
  const attachment = createMessage(AttachmentSchema, {
    name: asString(record.name) || `attachments/${asString(record.uid)}`,
    createTime: timestampFrom(record.createTime ?? record.createdTs),
    filename: asString(record.filename),
    content: new Uint8Array(),
    externalLink: asString(record.externalLink) || asString(record.downloadUrl),
    type: asString(record.type),
    size: asBigInt(record.size),
    memo: asString(record.memo) || undefined,
    motionMedia: isRecord(record.motionMedia) ? createMessage(MotionMediaSchema, record.motionMedia) : undefined,
  });

  return {
    ...attachment,
    id: asNumber(record.id),
    uid: asString(record.uid) || resourceId(attachment.name, "attachments"),
    downloadUrl: asString(record.downloadUrl) || attachment.externalLink,
  } as Attachment;
}

function normalizeReaction(raw: unknown, memoName?: string): Reaction {
  const record = isRecord(raw) ? raw : {};
  const reactionType = asString(record.reactionType) || asString(record.type);
  const contentId = asString(record.contentId) || memoName || (record.memoId ? `memos/${record.memoId}` : "");
  const creator = asString(record.creator) || (record.creatorUsername ? `users/${record.creatorUsername}` : "");
  return createMessage(ReactionSchema, {
    name: asString(record.name) || `${contentId}/reactions/${encodeURIComponent(reactionType)}`,
    creator,
    contentId,
    reactionType,
    createTime: timestampFrom(record.createTime ?? record.createdTs),
  });
}

function normalizeMemoRelation(raw: unknown, ownerMemoName?: string): MemoRelation {
  const record = isRecord(raw) ? raw : {};
  const memoName = asString(record.memoName) || asString(record.memo) || ownerMemoName || (record.memoId ? `memos/${record.memoId}` : "");
  const relatedName =
    asString(record.relatedMemoName) ||
    (isRecord(record.relatedMemo) ? asString(record.relatedMemo.name) : "") ||
    (record.relatedMemoId ? `memos/${record.relatedMemoId}` : "");
  const type = relationTypeFrom(record.type);

  return {
    ...createMessage(MemoRelationSchema, {
      memo: memoName
        ? createMessage(MemoRelation_MemoSchema, {
            name: memoName,
            snippet: isRecord(record.memo) ? asString(record.memo.snippet) : "",
          })
        : undefined,
      relatedMemo: relatedName
        ? createMessage(MemoRelation_MemoSchema, {
            name: relatedName,
            snippet: isRecord(record.relatedMemo) ? asString(record.relatedMemo.snippet) : "",
          })
        : undefined,
      type,
    }),
    relatedMemoId: asNumber(record.relatedMemoId),
  } as MemoRelation;
}

function relationTypeFrom(value: unknown): MemoRelation_Type {
  if (typeof value === "number") return value as MemoRelation_Type;
  if (value === "COMMENT") return MemoRelation_Type.COMMENT;
  if (value === "REFERENCE") return MemoRelation_Type.REFERENCE;
  return MemoRelation_Type.TYPE_UNSPECIFIED;
}

function relationTypeName(value: unknown): "COMMENT" | "REFERENCE" {
  const type = relationTypeFrom(value);
  return type === MemoRelation_Type.COMMENT ? "COMMENT" : "REFERENCE";
}

function normalizeMemo(raw: unknown): Memo {
  const record = isRecord(raw) ? raw : {};
  const name = asString(record.name) || `memos/${asString(record.uid) || asString(record.id)}`;
  const memo = createMessage(MemoSchema, {
    name,
    state: stateFrom(record.state ?? record.rowStatus),
    creator: asString(record.creator) || (record.creatorUsername ? `users/${record.creatorUsername}` : ""),
    createTime: timestampFrom(record.createTime ?? record.createdTs),
    updateTime: timestampFrom(record.updateTime ?? record.updatedTs),
    content: asString(record.content),
    visibility: visibilityFrom(record.visibility),
    entryType: memoEntryTypeFrom(record.entryType),
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
    pinned: Boolean(record.pinned),
    attachments: Array.isArray(record.attachments) ? record.attachments.map(normalizeAttachment) : [],
    relations: Array.isArray(record.relations) ? record.relations.map((relation) => normalizeMemoRelation(relation, name)) : [],
    reactions: Array.isArray(record.reactions) ? record.reactions.map((reaction) => normalizeReaction(reaction, name)) : [],
    property: isRecord(record.property) ? (record.property as Memo["property"]) : undefined,
    parent: asString(record.parent) || undefined,
    snippet: asString(record.snippet),
    location: isRecord(record.location) ? (record.location as Memo["location"]) : undefined,
  });

  return {
    ...memo,
    id: asNumber(record.id),
    uid: asString(record.uid) || resourceId(name, "memos"),
  } as Memo;
}

function normalizeMemoShare(raw: unknown): MemoShare {
  const record = isRecord(raw) ? raw : {};
  return createMessage(MemoShareSchema, {
    name: asString(record.name),
    createTime: timestampFrom(record.createTime ?? record.createdTs),
    expireTime: timestampFrom(record.expireTime ?? record.expiresTs),
  });
}

function normalizeShortcut(raw: unknown, parent?: string): Shortcut {
  const record = isRecord(raw) ? raw : {};
  const id = asString(record.id) || asString(record.shortcutId);
  return createMessage(ShortcutSchema, {
    name: asString(record.name) || (parent && id ? `${parent}/shortcuts/${id}` : ""),
    title: asString(record.title),
    filter: typeof record.filter === "string" ? record.filter : JSON.stringify(record.filter ?? {}),
  });
}

function normalizeLinkMetadata(raw: unknown): LinkMetadata {
  const record = isRecord(raw) ? raw : {};
  return createMessage(LinkMetadataSchema, {
    url: asString(record.url),
    title: asString(record.title),
    description: asString(record.description),
    image: asString(record.image),
  });
}

function normalizeUserSetting(raw: unknown, parent?: string): UserSetting {
  const record = isRecord(raw) ? raw : {};
  const name = asString(record.name) || (parent && record.key ? `${parent}/settings/${asString(record.key)}` : "");
  const key = settingKeyFromName(name, asString(record.key));
  const value = unwrapOneof(record.value);

  return createMessage(UserSettingSchema, {
    name,
    value: userSettingValue(key, value),
  });
}

function userSettingValue(key: string, value: unknown): UserSetting["value"] {
  switch (key) {
    case "WEBHOOKS":
      return { case: "webhooksSetting", value: value as never };
    case "TAGS":
      return { case: "tagsSetting", value: value as never };
    case "GENERAL":
    default:
      return { case: "generalSetting", value: value as never };
  }
}

function normalizeInstanceSetting(raw: unknown): InstanceSetting {
  const record = isRecord(raw) ? raw : {};
  const key = settingKeyFromName(asString(record.name), asString(record.key));
  return createMessage(InstanceSettingSchema, {
    name: asString(record.name) || `instance/settings/${key}`,
    value: instanceSettingValue(key, unwrapOneof(record.value)),
  });
}

function instanceSettingValue(key: string, rawValue: unknown): InstanceSetting["value"] {
  const value = isRecord(rawValue) ? { ...rawValue } : {};
  if ("uploadSizeLimitMb" in value) {
    value.uploadSizeLimitMb = asBigInt(value.uploadSizeLimitMb);
  }

  switch (key) {
    case "MEMO_RELATED":
      return { case: "memoRelatedSetting", value: value as never };
    case "TAGS":
      return { case: "tagsSetting", value: value as never };
    case "NOTIFICATION":
      return { case: "notificationSetting", value: value as never };
    case "GENERAL":
    default:
      return { case: "generalSetting", value: value as never };
  }
}

function settingKeyFromName(name: string, fallback = "GENERAL"): string {
  return (name.split("/").pop() || fallback || "GENERAL").toUpperCase();
}

function unwrapOneof(value: unknown): unknown {
  if (isRecord(value) && typeof value.case === "string" && "value" in value) {
    return value.value;
  }
  return value;
}

function serializeMemoInput(memo: Partial<Memo> | undefined, options: { includeEntryType?: boolean } = {}): JsonObject {
  const input: JsonObject = {
    name: memo?.name,
    content: memo?.content ?? "",
    visibility: visibilityName(memo?.visibility),
    pinned: memo?.pinned,
    createTime: timestampToIso(memo?.createTime),
    updateTime: timestampToIso(memo?.updateTime),
  };

  if (options.includeEntryType) {
    input.entryType = memoEntryTypeFrom(memo?.entryType);
  }

  return input;
}

function serializeUserInput(user: Partial<User> | undefined): JsonObject {
  return {
    name: user?.name,
    username: user?.username,
    email: user?.email,
    displayName: user?.displayName,
    nickname: user?.displayName,
    avatarUrl: user?.avatarUrl,
    description: user?.description,
    role: userRoleName(user?.role),
    state: stateName(user?.state),
  };
}

function timestampToIso(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const seconds = asBigInt(value.seconds);
  const nanos = asNumber(value.nanos);
  return new Date(Number(seconds) * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function formDataFromAttachment(request: { attachment?: Attachment; attachmentId?: string }): FormData {
  const attachment = request.attachment;
  if (!attachment) {
    throw new ApiError("attachment is required", ApiErrorCode.InvalidArgument);
  }

  const form = new FormData();
  const content = attachment.content ?? new Uint8Array();
  const blob = new Blob([new Uint8Array(content)], {
    type: attachment.type || "application/octet-stream",
  });
  form.set("file", blob, attachment.filename || "attachment");
  if (attachment.memo) {
    const numericMemoId = Number(resourceId(attachment.memo, "memos"));
    if (Number.isInteger(numericMemoId) && numericMemoId > 0) {
      form.set("memoId", String(numericMemoId));
    }
  }
  if (request.attachmentId) {
    form.set("attachmentId", request.attachmentId);
  }
  return form;
}

async function enrichMemo(memo: Memo): Promise<Memo> {
  const [attachments, relations, reactions] = await Promise.all([
    apiRequest<{ attachments?: unknown[] }>(`/api/v1/memos/${resourcePath(memo.name, "memos")}/attachments`).catch(() => ({
      attachments: [],
    })),
    apiRequest<{ relations?: unknown[] }>(`/api/v1/memos/${resourcePath(memo.name, "memos")}/relations`).catch(() => ({ relations: [] })),
    apiRequest<{ reactions?: unknown[] }>(`/api/v1/memos/${resourcePath(memo.name, "memos")}/reactions`).catch(() => ({ reactions: [] })),
  ]);
  return {
    ...memo,
    attachments: (attachments.attachments ?? []).map(normalizeAttachment),
    relations: (relations.relations ?? []).map((relation) => normalizeMemoRelation(relation, memo.name)),
    reactions: (reactions.reactions ?? []).map((reaction) => normalizeReaction(reaction, memo.name)),
  };
}

async function enrichMemos(memos: Memo[]): Promise<Memo[]> {
  return Promise.all(memos.map(enrichMemo));
}

function applyMemoSpaceFilter(memos: Memo[], space?: MemoSpace, entryType?: MemoEntryType): Memo[] {
  return memos.filter((memo) => {
    const memoEntryType = memoEntryTypeFrom(memo.entryType);
    if (entryType && memoEntryType !== entryType) {
      return false;
    }
    if (space === "community") {
      return memoEntryType === "COMMUNITY";
    }
    if (space === "private") {
      return memoEntryType === "MEMO" || memoEntryType === "DIARY";
    }
    return true;
  });
}

function applyMemoFilter(memos: Memo[], filter?: string): Memo[] {
  if (!filter) return memos;
  return memos.filter((memo) => memoMatchesFilter(memo, filter));
}

function memoMatchesFilter(memo: Memo, filter: string): boolean {
  const creator = filter.match(/creator\s*==\s*"([^"]+)"/)?.[1];
  if (creator && memo.creator !== creator) return false;

  const contentSearch = filter.match(/content\.contains\("((?:\\"|[^"])*)"\)/)?.[1];
  if (contentSearch && !memo.content.toLowerCase().includes(contentSearch.replace(/\\"/g, '"').toLowerCase())) return false;

  const tagSearch = filter.match(/tag\s+in\s+\["([^"]+)"\]/)?.[1];
  if (tagSearch && !memo.tags.includes(tagSearch)) return false;

  const visibilityValues = filter.match(/visibility\s+in\s+\[([^\]]+)\]/)?.[1];
  if (visibilityValues) {
    const allowed = visibilityValues
      .split(",")
      .map((value) => value.replace(/"/g, "").trim())
      .filter(Boolean);
    if (!allowed.includes(visibilityName(memo.visibility) ?? "")) return false;
  }

  if (/\bpinned\b/.test(filter) && !memo.pinned) return false;
  if (/\bhas_link\b/.test(filter) && !memo.property?.hasLink) return false;
  if (/\bhas_task_list\b/.test(filter) && !memo.property?.hasTaskList) return false;
  if (/\bhas_code\b/.test(filter) && !memo.property?.hasCode) return false;

  return true;
}

async function resolveRelationInput(relation: MemoRelation): Promise<JsonObject> {
  const relatedName = relation.relatedMemo?.name ?? "";
  let relatedMemoId = asNumber((relation as unknown as JsonObject).relatedMemoId);
  if (!relatedMemoId && relatedName) {
    const relatedMemo = await memoApi.getMemo({ name: relatedName });
    relatedMemoId = asNumber((relatedMemo as unknown as JsonObject).id);
  }
  if (!relatedMemoId) {
    throw new ApiError("related memo id is required", ApiErrorCode.InvalidArgument);
  }
  return {
    relatedMemoId,
    type: relationTypeName(relation.type),
  };
}

async function resolveAttachmentIds(attachments: Attachment[]): Promise<number[]> {
  const ids: number[] = [];
  for (const attachment of attachments) {
    const id = asNumber((attachment as unknown as JsonObject).id);
    if (id) {
      ids.push(id);
      continue;
    }
    const fetched = await attachmentApi.getAttachment({ name: attachment.name });
    const fetchedId = asNumber((fetched as unknown as JsonObject).id);
    if (fetchedId) ids.push(fetchedId);
  }
  return ids;
}

export const instanceApi = {
  async getInstanceProfile(_request?: unknown): Promise<InstanceProfile> {
    const data = await apiRequest<JsonObject>("/api/v1/instance/profile");
    return createMessage(InstanceProfileSchema, {
      version: asString(data.version) || "cloudflare-worker",
      demo: Boolean(data.demo),
      instanceUrl: asString(data.instanceUrl),
      admin: isRecord(data.admin) ? normalizeUser(data.admin) : undefined,
      commit: asString(data.commit),
      needsSetup: Boolean(data.needsSetup),
    });
  },

  async getInstanceSetting(request: { name: string }): Promise<InstanceSetting> {
    const key = settingKeyFromName(request.name);
    const data = await apiRequest<{ setting: unknown }>(`/api/v1/instance/settings/${encodeURIComponent(key)}`);
    return normalizeInstanceSetting(data.setting);
  },

  async batchGetInstanceSettings(request: { names: string[] }): Promise<{ settings: InstanceSetting[] }> {
    const data = await apiRequest<{ settings?: unknown[] }>("/api/v1/instance/settings:batchGet", {
      method: "POST",
      body: { names: request.names },
    });
    return { settings: (data.settings ?? []).map(normalizeInstanceSetting) };
  },

  async updateInstanceSetting(request: { setting?: InstanceSetting }): Promise<InstanceSetting> {
    if (!request.setting) {
      throw new ApiError("setting is required", ApiErrorCode.InvalidArgument);
    }
    const key = settingKeyFromName(request.setting.name);
    const data = await apiRequest<{ setting: unknown }>(`/api/v1/instance/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: {
        value: unwrapOneof(request.setting.value),
      },
    });
    return normalizeInstanceSetting(data.setting);
  },

  async testInstanceEmailSetting(request: { email?: unknown; recipientEmail?: string }): Promise<void> {
    await apiRequest("/api/v1/instance/settings/notification:testEmail", {
      method: "POST",
      body: {
        email: request.email,
        recipientEmail: request.recipientEmail,
      },
    });
  },
};

export const authApi = {
  async getCurrentUser(_request?: unknown): Promise<{ user?: User }> {
    const data = await apiRequest<{ user?: unknown }>("/api/v1/auth/me");
    return { user: data.user ? normalizeUser(data.user) : undefined };
  },

  async signOut(_request?: unknown): Promise<void> {
    await apiRequest("/api/v1/auth/signout", { method: "POST" }).catch(() => undefined);
    clearAccessToken();
    await signOutClerkSession();
  },

  async signIn(_request?: unknown): Promise<{ accessToken?: string; accessTokenExpiresAt?: ReturnType<typeof timestampFromDate> }> {
    throw new ApiError("Built-in sign-in is removed; use Clerk session authentication", ApiErrorCode.Unimplemented);
  },

  async refreshToken(_request?: unknown): Promise<{ accessToken?: string; expiresAt?: ReturnType<typeof timestampFromDate> }> {
    throw new ApiError("Token refresh is managed by Clerk", ApiErrorCode.Unimplemented);
  },
};

export const userApi = {
  async listUsers(request: { pageSize?: number; showDeleted?: boolean } = {}) {
    const data = await apiRequest<{ users?: unknown[]; totalSize?: number; total_size?: number }>("/api/v1/users", {
      query: {
        pageSize: request.pageSize,
        showDeleted: request.showDeleted,
      },
    });
    return {
      users: (data.users ?? []).map(normalizeUser),
      nextPageToken: "",
      totalSize: asNumber(data.totalSize ?? data.total_size ?? data.users?.length),
    };
  },

  async batchGetUsers(request: { usernames: string[] }) {
    const data = await apiRequest<{ users?: unknown[] }>("/api/v1/users:batchGet", {
      method: "POST",
      body: { usernames: request.usernames },
    });
    return { users: (data.users ?? []).map(normalizeUser) };
  },

  async getUser(request: { name: string }): Promise<User> {
    const data = await apiRequest<{ user: unknown }>(`/api/v1/users/${resourcePath(request.name, "users")}`);
    return normalizeUser(data.user);
  },

  async createUser(_request?: unknown): Promise<never> {
    throw new ApiError("Built-in user creation is removed; users are synced from Clerk sessions", ApiErrorCode.Unimplemented);
  },

  async updateUser(request: { user?: Partial<User>; updateMask?: { paths?: string[] } }): Promise<User> {
    if (!request.user?.name) {
      throw new ApiError("user.name is required", ApiErrorCode.InvalidArgument);
    }
    const data = await apiRequest<{ user: unknown }>(`/api/v1/users/${resourcePath(request.user.name, "users")}`, {
      method: "PATCH",
      body: { user: serializeUserInput(request.user) },
    });
    return normalizeUser(data.user);
  },

  async deleteUser(request: { name: string }): Promise<void> {
    await apiRequest(`/api/v1/users/${resourcePath(request.name, "users")}`, { method: "DELETE" });
  },

  async getUserStats(request: { name: string }) {
    const username = resourcePath(request.name, "users");
    if (!username) {
      throw new ApiError("user name is required", ApiErrorCode.InvalidArgument);
    }
    const data = await apiRequest<JsonObject>(`/api/v1/users/${username}/stats`);
    return createMessage(UserStatsSchema, {
      name: asString(data.name) || request.name,
      totalMemoCount: asNumber(data.totalMemoCount ?? data.memoCount),
      tagCount: isRecord(data.tagCount) ? (data.tagCount as Record<string, number>) : {},
      pinnedMemos: Array.isArray(data.pinnedMemos) ? data.pinnedMemos.filter((name): name is string => typeof name === "string") : [],
    });
  },

  async listAllUserStats(_request?: unknown) {
    const data = await apiRequest<{ stats?: unknown[] }>("/api/v1/users/stats");
    return {
      stats: (data.stats ?? []).map((raw) => {
        const record = isRecord(raw) ? raw : {};
        return createMessage(UserStatsSchema, {
          name: asString(record.name) || `users/${asString(record.username)}`,
          totalMemoCount: asNumber(record.totalMemoCount ?? record.memoCount),
          tagCount: isRecord(record.tagCount) ? (record.tagCount as Record<string, number>) : {},
        });
      }),
    };
  },

  async listUserSettings(request: { parent: string }) {
    const data = await apiRequest<{ settings?: unknown[] }>(`/api/v1/users/${resourcePath(request.parent, "users")}/settings`);
    return {
      settings: (data.settings ?? []).map((setting) => normalizeUserSetting(setting, request.parent)),
      nextPageToken: "",
      totalSize: data.settings?.length ?? 0,
    };
  },

  async updateUserSetting(request: { setting?: UserSetting; updateMask?: { paths?: string[] } }) {
    if (!request.setting) {
      throw new ApiError("setting is required", ApiErrorCode.InvalidArgument);
    }
    const parts = request.setting.name.split("/");
    const username = parts[1] ?? "";
    const key = parts[3] ?? settingKeyFromName(request.setting.name, UserSetting_Key[UserSetting_Key.GENERAL]);
    const data = await apiRequest<{ setting: unknown }>(
      `/api/v1/users/${encodeURIComponent(username)}/settings/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        body: { value: unwrapOneof(request.setting.value) },
      },
    );
    return normalizeUserSetting(data.setting, `users/${username}`);
  },

  async listUserNotifications(_request?: unknown) {
    return { notifications: [] as UserNotification[], nextPageToken: "", totalSize: 0 };
  },

  async updateUserNotification(_request?: unknown) {
    throw new ApiError("Inbox notifications are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },

  async deleteUserNotification(_request?: unknown) {
    throw new ApiError("Inbox notifications are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },

  async listUserWebhooks(_request?: unknown) {
    return { webhooks: [] as UserWebhook[] };
  },

  async createUserWebhook(_request?: unknown): Promise<UserWebhook> {
    throw new ApiError("User webhooks are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },

  async updateUserWebhook(_request?: unknown): Promise<UserWebhook> {
    throw new ApiError("User webhooks are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },

  async deleteUserWebhook(_request?: unknown): Promise<void> {
    throw new ApiError("User webhooks are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },

  async getUserWebhookSigningSecret(_request?: unknown): Promise<{ signingSecret: string }> {
    throw new ApiError("User webhooks are not implemented in the Cloudflare Worker backend yet", ApiErrorCode.Unimplemented);
  },
};

export const memoApi = {
  async listMemos(
    request: { pageSize?: number; pageToken?: string; state?: State; filter?: string; space?: MemoSpace; entryType?: MemoEntryType } = {},
  ) {
    if (request.state === State.ARCHIVED) {
      return { memos: [], nextPageToken: "" };
    }
    const data = await apiRequest<{ memos?: unknown[]; nextCursor?: string; nextPageToken?: string }>("/api/v1/memos", {
      query: {
        pageSize: request.pageSize,
        cursor: request.pageToken,
        space: memoSpaceName(request.space),
        entryType: request.entryType,
      },
    });
    const memos = await enrichMemos(
      applyMemoFilter(applyMemoSpaceFilter((data.memos ?? []).map(normalizeMemo), request.space, request.entryType), request.filter),
    );
    return {
      memos,
      nextPageToken: data.nextPageToken || data.nextCursor || "",
    };
  },

  async getMemo(request: { name: string }): Promise<Memo> {
    const data = await apiRequest<{ memo: unknown }>(`/api/v1/memos/${resourcePath(request.name, "memos")}`);
    return enrichMemo(normalizeMemo(data.memo));
  },

  async createMemo(request: { memo?: Partial<Memo>; memoId?: string }): Promise<Memo> {
    const data = await apiRequest<{ memo: unknown }>("/api/v1/memos", {
      method: "POST",
      body: {
        memo: serializeMemoInput(request.memo, { includeEntryType: true }),
        memoId: request.memoId,
      },
    });
    let memo = normalizeMemo(data.memo);
    if (request.memo?.attachments?.length) {
      await memoApi.setMemoAttachments({ name: memo.name, attachments: request.memo.attachments });
    }
    if (request.memo?.relations?.length) {
      await memoApi.setMemoRelations({ name: memo.name, relations: request.memo.relations });
    }
    memo = await memoApi.getMemo({ name: memo.name });
    return memo;
  },

  async updateMemo(request: { memo?: Partial<Memo>; updateMask?: { paths?: string[] } }): Promise<Memo> {
    if (!request.memo?.name) {
      throw new ApiError("memo.name is required", ApiErrorCode.InvalidArgument);
    }
    const paths = new Set(request.updateMask?.paths ?? []);
    await apiRequest<{ memo: unknown }>(`/api/v1/memos/${resourcePath(request.memo.name, "memos")}`, {
      method: "PATCH",
      body: { memo: serializeMemoInput(request.memo, { includeEntryType: paths.has("entryType") || paths.has("entry_type") }) },
    });
    if (paths.has("attachments") && request.memo.attachments) {
      await memoApi.setMemoAttachments({ name: request.memo.name, attachments: request.memo.attachments });
    }
    if (paths.has("relations") && request.memo.relations) {
      await memoApi.setMemoRelations({ name: request.memo.name, relations: request.memo.relations });
    }
    return memoApi.getMemo({ name: request.memo.name });
  },

  async deleteMemo(request: { name: string }): Promise<void> {
    await apiRequest(`/api/v1/memos/${resourcePath(request.name, "memos")}`, { method: "DELETE" });
  },

  async listMemoComments(request: { name: string; pageSize?: number; pageToken?: string }) {
    const data = await apiRequest<{ comments?: unknown[]; memos?: unknown[]; nextCursor?: string; nextPageToken?: string }>(
      `/api/v1/memos/${resourcePath(request.name, "memos")}/comments`,
      {
        query: {
          pageSize: request.pageSize,
          cursor: request.pageToken,
        },
      },
    );
    const memos = await enrichMemos((data.memos ?? data.comments ?? []).map(normalizeMemo));
    return {
      memos,
      nextPageToken: data.nextPageToken || data.nextCursor || "",
      totalSize: memos.length,
    };
  },

  async createMemoComment(request: { name: string; comment?: Partial<Memo> }): Promise<Memo> {
    const data = await apiRequest<{ memo?: unknown; comment?: unknown }>(`/api/v1/memos/${resourcePath(request.name, "memos")}/comments`, {
      method: "POST",
      body: { comment: serializeMemoInput(request.comment, { includeEntryType: true }) },
    });
    return enrichMemo(normalizeMemo(data.memo ?? data.comment));
  },

  async listMemoAttachments(request: { name: string; pageSize?: number; pageToken?: string }) {
    const data = await apiRequest<{ attachments?: unknown[]; nextCursor?: string; nextPageToken?: string }>(
      `/api/v1/memos/${resourcePath(request.name, "memos")}/attachments`,
      {
        query: {
          pageSize: request.pageSize,
          cursor: request.pageToken,
        },
      },
    );
    return {
      attachments: (data.attachments ?? []).map(normalizeAttachment),
      nextPageToken: data.nextPageToken || data.nextCursor || "",
    };
  },

  async setMemoAttachments(request: { name: string; attachments: Attachment[] }): Promise<void> {
    const attachmentIds = await resolveAttachmentIds(request.attachments);
    await apiRequest(`/api/v1/memos/${resourcePath(request.name, "memos")}/attachments`, {
      method: "PUT",
      body: { attachmentIds },
    });
  },

  async listMemoRelations(request: { name: string; pageSize?: number; pageToken?: string }) {
    const data = await apiRequest<{ relations?: unknown[]; nextCursor?: string; nextPageToken?: string }>(
      `/api/v1/memos/${resourcePath(request.name, "memos")}/relations`,
      {
        query: {
          pageSize: request.pageSize,
          cursor: request.pageToken,
        },
      },
    );
    return {
      relations: (data.relations ?? []).map((relation) => normalizeMemoRelation(relation, request.name)),
      nextPageToken: data.nextPageToken || data.nextCursor || "",
    };
  },

  async setMemoRelations(request: { name: string; relations: MemoRelation[] }): Promise<void> {
    const relations = await Promise.all(request.relations.map(resolveRelationInput));
    await apiRequest(`/api/v1/memos/${resourcePath(request.name, "memos")}/relations`, {
      method: "PUT",
      body: { relations },
    });
  },

  async listMemoReactions(request: { name: string }) {
    const data = await apiRequest<{ reactions?: unknown[] }>(`/api/v1/memos/${resourcePath(request.name, "memos")}/reactions`);
    return {
      reactions: (data.reactions ?? []).map((reaction) => normalizeReaction(reaction, request.name)),
      nextPageToken: "",
      totalSize: data.reactions?.length ?? 0,
    };
  },

  async upsertMemoReaction(request: { name: string; reaction?: Partial<Reaction> }): Promise<Reaction> {
    const reactionType = request.reaction?.reactionType ?? "";
    const data = await apiRequest<{ reaction: unknown }>(
      `/api/v1/memos/${resourcePath(request.name, "memos")}/reactions/${encodeURIComponent(reactionType)}`,
      {
        method: "PUT",
      },
    );
    return normalizeReaction(data.reaction, request.name);
  },

  async deleteMemoReaction(request: { name: string }): Promise<void> {
    const parts = request.name.split("/");
    const memoName = `${parts[0]}/${parts[1]}`;
    const reactionType = decodeURIComponent(parts.slice(3).join("/"));
    await apiRequest(`/api/v1/memos/${resourcePath(memoName, "memos")}/reactions/${encodeURIComponent(reactionType)}`, {
      method: "DELETE",
    });
  },

  async listMemoShares(request: { parent: string }) {
    const data = await apiRequest<{ shares?: unknown[]; memoShares?: unknown[] }>(
      `/api/v1/memos/${resourcePath(request.parent, "memos")}/shares`,
    );
    return { memoShares: (data.memoShares ?? data.shares ?? []).map(normalizeMemoShare) };
  },

  async createMemoShare(request: { parent: string; memoShare?: Partial<MemoShare> }): Promise<MemoShare> {
    const data = await apiRequest<{ share?: unknown; memoShare?: unknown }>(
      `/api/v1/memos/${resourcePath(request.parent, "memos")}/shares`,
      {
        method: "POST",
        body: {
          expiresTs: request.memoShare?.expireTime ? Number(asBigInt(request.memoShare.expireTime.seconds)) : undefined,
        },
      },
    );
    return normalizeMemoShare(data.memoShare ?? data.share);
  },

  async deleteMemoShare(request: { name: string }): Promise<void> {
    const parts = request.name.split("/");
    const memoName = `${parts[0]}/${parts[1]}`;
    const shareId = parts[3] ?? "";
    await apiRequest(`/api/v1/memos/${resourcePath(memoName, "memos")}/shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
  },

  async getMemoByShare(request: { shareId: string }): Promise<Memo> {
    const data = await apiRequest<{ memo: unknown }>(`/api/v1/shares/${encodeURIComponent(request.shareId)}`);
    return normalizeMemo(data.memo);
  },

  async getLinkMetadata(request: { url: string }): Promise<LinkMetadata> {
    const data = await apiRequest<{ metadata?: unknown; linkMetadata?: unknown }>("/api/v1/memos/-/linkMetadata", {
      query: { url: request.url },
    });
    return normalizeLinkMetadata(data.linkMetadata ?? data.metadata);
  },

  async batchGetLinkMetadata(request: { urls: string[] }) {
    const data = await apiRequest<{ linkMetadata?: unknown[] }>("/api/v1/memos/-/linkMetadata:batchGet", {
      method: "POST",
      body: { urls: request.urls },
    });
    return { linkMetadata: (data.linkMetadata ?? []).map(normalizeLinkMetadata) };
  },
};

export const attachmentApi = {
  async listAttachments(request: { pageSize?: number; pageToken?: string } = {}) {
    const data = await apiRequest<{ attachments?: unknown[]; nextCursor?: string; nextPageToken?: string }>("/api/v1/attachments", {
      query: {
        pageSize: request.pageSize,
        cursor: request.pageToken,
      },
    });
    return {
      attachments: (data.attachments ?? []).map(normalizeAttachment),
      nextPageToken: data.nextPageToken || data.nextCursor || "",
      totalSize: data.attachments?.length ?? 0,
    };
  },

  async getAttachment(request: { name: string }): Promise<Attachment> {
    const data = await apiRequest<{ attachment: unknown }>(`/api/v1/attachments/${resourcePath(request.name, "attachments")}`);
    return normalizeAttachment(data.attachment);
  },

  async createAttachment(request: { attachment?: Attachment; attachmentId?: string }): Promise<Attachment> {
    const data = await apiRequest<{ attachment: unknown }>("/api/v1/attachments", {
      method: "POST",
      formData: formDataFromAttachment(request),
    });
    return normalizeAttachment(data.attachment);
  },

  async updateAttachment(request: { attachment?: Attachment }): Promise<Attachment> {
    if (!request.attachment?.name) {
      throw new ApiError("attachment.name is required", ApiErrorCode.InvalidArgument);
    }
    const data = await apiRequest<{ attachment: unknown }>(`/api/v1/attachments/${resourcePath(request.attachment.name, "attachments")}`, {
      method: "PATCH",
      body: { attachment: request.attachment },
    });
    return normalizeAttachment(data.attachment);
  },

  async deleteAttachment(request: { name: string }): Promise<void> {
    await apiRequest(`/api/v1/attachments/${resourcePath(request.name, "attachments")}`, { method: "DELETE" });
  },

  async batchDeleteAttachments(request: { names: string[] }): Promise<void> {
    await apiRequest("/api/v1/attachments:batchDelete", {
      method: "POST",
      body: { names: request.names },
    });
  },
};

export const shortcutApi = {
  async listShortcuts(request: { parent?: string } = {}) {
    const path = request.parent ? `/api/v1/users/${resourcePath(request.parent, "users")}/shortcuts` : "/api/v1/shortcuts";
    const data = await apiRequest<{ shortcuts?: unknown[] }>(path);
    return { shortcuts: (data.shortcuts ?? []).map((shortcut) => normalizeShortcut(shortcut, request.parent)) };
  },

  async createShortcut(request: { parent?: string; shortcut?: Shortcut; validateOnly?: boolean }): Promise<Shortcut> {
    if (request.validateOnly) {
      return normalizeShortcut(request.shortcut, request.parent);
    }
    const path = request.parent ? `/api/v1/users/${resourcePath(request.parent, "users")}/shortcuts` : "/api/v1/shortcuts";
    const data = await apiRequest<{ shortcut: unknown }>(path, {
      method: "POST",
      body: {
        shortcut: {
          title: request.shortcut?.title,
          filter: request.shortcut?.filter,
        },
      },
    });
    return normalizeShortcut(data.shortcut, request.parent);
  },

  async updateShortcut(request: { shortcut?: Shortcut; updateMask?: { paths?: string[] } }): Promise<Shortcut> {
    if (!request.shortcut?.name) {
      throw new ApiError("shortcut.name is required", ApiErrorCode.InvalidArgument);
    }
    const { username, shortcutId } = shortcutPath(request.shortcut.name);
    const data = await apiRequest<{ shortcut: unknown }>(
      `/api/v1/users/${encodeURIComponent(username)}/shortcuts/${encodeURIComponent(shortcutId)}`,
      {
        method: "PATCH",
        body: {
          shortcut: {
            title: request.shortcut.title,
            filter: request.shortcut.filter,
          },
        },
      },
    );
    return normalizeShortcut(data.shortcut, `users/${username}`);
  },

  async deleteShortcut(request: { name: string }): Promise<void> {
    const { username, shortcutId } = shortcutPath(request.name);
    await apiRequest(`/api/v1/users/${encodeURIComponent(username)}/shortcuts/${encodeURIComponent(shortcutId)}`, { method: "DELETE" });
  },
};

export function handleAuthFailureRedirect(error: unknown): void {
  if (error instanceof ApiError && error.code === ApiErrorCode.Unauthenticated) {
    redirectOnAuthFailure();
  }
}
