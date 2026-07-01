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
    for (const path of ["/api/v1/users:sync", "/api/v1/memos", "/api/v1/attachments"]) {
      const response = await app.request(path, { method: path.endsWith("sync") ? "POST" : "GET" }, testEnv);

      expect(response.status, path).toBe(401);
      await expect(response.json(), path).resolves.toMatchObject({
        error: {
          code: "unauthenticated"
        }
      });
    }
  });
});
