import { HttpError } from "../http/errors";

export function memoName(uid: string): string {
  return `memos/${uid}`;
}

export function userName(username: string): string {
  return `users/${username}`;
}

export function attachmentName(uid: string): string {
  return `attachments/${uid}`;
}

export function shortcutName(username: string, id: number | string): string {
  return `${userName(username)}/shortcuts/${id}`;
}

export function parseMemoName(value: string): string {
  return parseResourceName(value, "memos", "memo name");
}

export function parseUserName(value: string): string {
  return parseResourceName(value, "users", "user name");
}

export function parseAttachmentName(value: string): string {
  return parseResourceName(value, "attachments", "attachment name");
}

export function parsePositiveId(value: string, label: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== value) {
    throw new HttpError(400, "bad_request", `Invalid ${label}`);
  }
  return id;
}

export function parseResourceIdOrName(value: string, prefix: string, label: string): string {
  return value.startsWith(`${prefix}/`) ? parseResourceName(value, prefix, label) : decodeURIComponent(value);
}

function parseResourceName(value: string, prefix: string, label: string): string {
  const parts = value.split("/");
  if (parts.length !== 2 || parts[0] !== prefix || parts[1].trim() === "") {
    throw new HttpError(400, "bad_request", `Invalid ${label}`);
  }
  return decodeURIComponent(parts[1]);
}
