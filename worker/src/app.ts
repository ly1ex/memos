import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./env";
import { HttpError, toErrorResponse } from "./http/errors";
import { parseCsv } from "./utils/csv";
import { apiRoutes } from "./routes/api";
import { fileRoutes } from "./routes/files";
import { healthRoutes } from "./routes/health";
import { mcpRoutes } from "./routes/mcp";
import { rssRoutes } from "./routes/rss";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigins = parseCsv(c.env.CORS_ORIGINS);
      if (allowedOrigins.length === 0 || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return origin;
      }
      return undefined;
    },
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.route("/", healthRoutes);
app.route("/api/v1", apiRoutes);
app.route("/file", fileRoutes);
app.route("/", rssRoutes);
app.route("/mcp", mcpRoutes);

app.all("/api/v1/sse", () => {
  throw new HttpError(410, "not_implemented", "SSE is removed in the Cloudflare Worker backend; clients must poll.");
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "not_found",
        message: "Route not found"
      }
    },
    404
  )
);

app.onError((error, c) => toErrorResponse(c, error));

export default app;
