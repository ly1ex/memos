import type { Context } from "hono";

import type { AppEnv } from "../env";

export type ErrorCode =
  | "bad_request"
  | "unauthenticated"
  | "permission_denied"
  | "not_found"
  | "not_implemented"
  | "internal";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function notImplemented(feature: string): HttpError {
  return new HttpError(501, "not_implemented", `${feature} is not implemented in the Cloudflare Worker backend yet.`);
}

export function toErrorResponse(c: Context<AppEnv>, error: unknown): Response {
  if (error instanceof HttpError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message
        }
      },
      error.status as never
    );
  }

  console.error(error);
  return c.json(
    {
      error: {
        code: "internal",
        message: "Internal server error"
      }
    },
    500
  );
}

