import { describe, expect, it } from "vitest";

import app from "../src/app";
import type { Env } from "../src/env";

const testEnv = {
  DB: {} as D1Database,
  ATTACHMENTS: {} as R2Bucket,
  CORS_ORIGINS: "*",
  CLERK_AUTHORIZED_PARTIES: "http://localhost:3001"
} satisfies Env;

describe("worker app", () => {
  it("responds to health checks", async () => {
    const response = await app.request("/healthz", {}, testEnv);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        status: "ok"
      }
    });
  });

  it("exposes the Cloudflare edition instance profile", async () => {
    const response = await app.request("/api/v1/instance/profile", {}, testEnv);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        mode: "cloudflare-worker",
        authProvider: "clerk",
        database: "d1",
        objectStorage: "r2",
        realtime: "polling",
        mcp: true
      }
    });
  });

  it("returns MCP initialize response", async () => {
    const response = await app.request(
      "/mcp",
      {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize"
        })
      },
      testEnv
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: {
          name: "memos-cloudflare-worker"
        }
      }
    });
  });

  it("requires auth for MCP tool calls", async () => {
    const response = await app.request(
      "/mcp",
      {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "list_memos",
            arguments: {}
          }
        })
      },
      testEnv
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: {
        message: "Authentication required"
      }
    });
  });

  it("marks SSE as removed", async () => {
    const response = await app.request("/api/v1/sse", {}, testEnv);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_implemented",
        message: "SSE is removed in the Cloudflare Worker backend; clients must poll."
      }
    });
  });

  it("protects sync and data routes with Clerk auth", async () => {
    for (const route of [
      { path: "/api/v1/users:sync", method: "POST" },
      { path: "/api/v1/attachments", method: "GET" },
      { path: "/api/v1/instance/settings/notification:testEmail", method: "POST" }
    ]) {
      const response = await app.request(route.path, { method: route.method }, testEnv);

      expect(response.status, route.path).toBe(401);
      await expect(response.json(), route.path).resolves.toMatchObject({
        error: {
          code: "unauthenticated"
        }
      });
    }
  });

  it("keeps legacy colon routes reachable", async () => {
    const batchResponse = await app.request(
      "/api/v1/users:batchGet",
      {
        method: "POST",
        body: JSON.stringify({ usernames: [] })
      },
      testEnv
    );
    expect(batchResponse.status).toBe(200);

    const restStatsResponse = await app.request("/api/v1/users/stats", {}, testEnv);
    expect(restStatsResponse.status).toBe(401);

    const statsResponse = await app.request("/api/v1/users:stats", {}, testEnv);
    expect(statsResponse.status).toBe(401);
  });

  it("serves per-user stats on the REST path", async () => {
    const env = {
      ...testEnv,
      DB: userStatsDb("target", 7)
    } satisfies Env;

    const response = await app.request("/api/v1/users/target/stats", {}, env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        name: "users/target",
        memoCount: 7
      }
    });
  });

  it("requires admin auth before reading sensitive instance settings", async () => {
    const response = await app.request("/api/v1/instance/settings/NOTIFICATION", {}, testEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "unauthenticated"
      }
    });
  });
});

function userStatsDb(username: string, memoCount: number): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM "user"')) {
                return values[0] === username
                  ? {
                      id: 1,
                      clerkUserId: "clerk_target",
                      username,
                      email: "",
                      nickname: username,
                      avatarUrl: "",
                      role: "USER",
                      rowStatus: "NORMAL",
                      createdTs: 1,
                      updatedTs: 1
                    }
                  : null;
              }
              if (sql.includes("FROM memo")) {
                return { memoCount };
              }
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}
