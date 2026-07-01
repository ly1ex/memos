import { verifyToken } from "@clerk/backend";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import type { AppEnv, AuthContext } from "../env";
import { HttpError } from "../http/errors";
import { getOrCreateUserByClerkUserId } from "../repositories/users";
import { parseCsv } from "../utils/csv";

interface ClerkJwtPayload {
  sub?: string;
  sid?: string;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = await resolveAuthContext(c, true);
  c.set("auth", auth);

  await next();
});

export async function resolveOptionalAuthContext(c: Context<AppEnv>): Promise<AuthContext | null> {
  return resolveAuthContext(c, false);
}

async function resolveAuthContext(c: Context<AppEnv>, required: true): Promise<AuthContext>;
async function resolveAuthContext(c: Context<AppEnv>, required: false): Promise<AuthContext | null>;
async function resolveAuthContext(c: Context<AppEnv>, required: boolean): Promise<AuthContext | null> {
  const token = getSessionToken(c.req.raw.headers.get("Authorization"), getCookie(c, "__session"));
  if (!token) {
    if (required) {
      throw new HttpError(401, "unauthenticated", "Authentication required");
    }
    return null;
  }

  if (!c.env.CLERK_SECRET_KEY && !c.env.CLERK_JWT_KEY) {
    throw new HttpError(500, "internal", "Clerk verification is not configured");
  }

  const verifiedToken = (await verifyToken(token, {
    secretKey: c.env.CLERK_SECRET_KEY,
    jwtKey: c.env.CLERK_JWT_KEY,
    authorizedParties: parseCsv(c.env.CLERK_AUTHORIZED_PARTIES)
  })) as ClerkJwtPayload;

  if (!verifiedToken.sub) {
    throw new HttpError(401, "unauthenticated", "Invalid Clerk session");
  }

  const localUser = await getOrCreateUserByClerkUserId(c.env.DB, verifiedToken.sub);
  return {
    clerkUserId: verifiedToken.sub,
    sessionId: verifiedToken.sid,
    localUser
  };
}

function getSessionToken(authorization: string | null, sessionCookie: string | undefined): string | undefined {
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return sessionCookie;
}
