import type { Context } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "./errors";

export async function readJsonObject(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const body = await c.req.json<unknown>().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "bad_request", "Expected a JSON object body");
  }
  return body as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "bad_request", `Missing required string field: ${key}`);
  }
  return value;
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "bad_request", `Invalid string field: ${key}`);
  }
  return value;
}

export function optionalBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, "bad_request", `Invalid boolean field: ${key}`);
  }
  return value;
}

export function intPathParam(c: Context<AppEnv>, key: string): number {
  const rawValue = c.req.param(key);
  if (!rawValue) {
    throw new HttpError(400, "bad_request", `Invalid path parameter: ${key}`);
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "bad_request", `Invalid path parameter: ${key}`);
  }
  return value;
}
