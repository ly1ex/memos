import { HttpError } from "../http/errors";

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface CreatedCursor {
  createdTs: number;
  id: number;
}

export function clampPageSize(value: string | null, fallback = 20, max = 100): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, "bad_request", "Invalid pageSize");
  }

  return Math.min(parsed, max);
}

export function encodeCreatedCursor(cursor: CreatedCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeCreatedCursor(value: string | null): CreatedCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<CreatedCursor>;
    const createdTs = parsed.createdTs;
    const id = parsed.id;
    if (typeof createdTs !== "number" || typeof id !== "number" || !Number.isInteger(createdTs) || !Number.isInteger(id)) {
      throw new Error("Invalid cursor fields");
    }
    return {
      createdTs,
      id
    };
  } catch (_error) {
    throw new HttpError(400, "bad_request", "Invalid cursor");
  }
}

export function pageFromLimit<T extends CreatedCursor>(items: T[], pageSize: number): CursorPage<T> {
  const visibleItems = items.slice(0, pageSize);
  const lastItem = visibleItems.at(-1);
  return {
    items: visibleItems,
    nextCursor: items.length > pageSize && lastItem ? encodeCreatedCursor(lastItem) : undefined
  };
}

function encodeBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}
