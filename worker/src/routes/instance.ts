import { Hono } from "hono";
import type { Context } from "hono";

import type { AppEnv } from "../env";
import { extractNotificationEmailSetting, parseNotificationEmailSetting, sendNotificationEmail } from "../email/notification";
import { HttpError } from "../http/errors";
import { readJsonObject, requiredString } from "../http/request";
import { ok } from "../http/responses";
import { requireAdmin } from "../middleware/admin";
import { getSystemSetting, listSystemSettingsByNames, upsertSystemSetting, type SystemSetting } from "../repositories/settings";

export const instanceRoutes = new Hono<AppEnv>();

instanceRoutes.get("/profile", (c) =>
  c.json(
    ok({
      mode: "cloudflare-worker",
      authProvider: "clerk",
      database: "d1",
      objectStorage: "r2",
      realtime: "polling",
      mcp: true
    })
  )
);

instanceRoutes.get("/settings/:key", async (c) => {
  const key = c.req.param("key");
  requireSupportedSettingKeys([key]);
  await requireSettingReadAccess(c, [key]);

  const setting = await getSystemSetting(c.env.DB, key);
  if (!setting) {
    throw new HttpError(404, "not_found", "Instance setting not found");
  }
  return c.json(ok({ setting: redactSettingForResponse(setting) }));
});

instanceRoutes.get("/settings:batchGet", async (c) => {
  const names = (c.req.query("names") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  requireSupportedSettingKeys(names);
  await requireSettingReadAccess(c, names);

  const settings = (await listSystemSettingsByNames(c.env.DB, names)).map(redactSettingForResponse);
  return c.json(ok({ settings }));
});

instanceRoutes.post("/settings:batchGet", async (c) => {
  const body = await readJsonObject(c);
  const names = parseSettingNames(body.names);
  requireSupportedSettingKeys(names);
  await requireSettingReadAccess(c, names);

  const settings = (await listSystemSettingsByNames(c.env.DB, names)).map(redactSettingForResponse);
  return c.json(ok({ settings }));
});

instanceRoutes.patch("/settings/:key", requireAdmin, async (c) => {
  const key = c.req.param("key");
  requireSupportedSettingKeys([key]);
  const body = await readJsonObject(c);
  const setting = await upsertSystemSetting(c.env.DB, {
    name: key,
    value: body.value,
    description: body.description === undefined ? "" : requiredString(body, "description")
  });
  return c.json(ok({ setting }));
});

instanceRoutes.post("/settings/notification:testEmail", requireAdmin, async (c) => {
  const body = await readOptionalJsonObject(c);
  const email = await resolveTestEmailSetting(c, body.email);
  const recipientEmail = readOptionalString(body.recipientEmail, "recipientEmail")?.trim() || c.get("auth").localUser.email.trim();
  if (!recipientEmail) {
    throw new HttpError(400, "bad_request", "recipientEmail is required");
  }

  const messageId = await sendNotificationEmail(c.env, {
    email,
    to: recipientEmail,
    subject: "[Memos] Test email",
    text: "This is a test email from your Memos notification settings."
  });

  return c.json(ok({ messageId }));
});

async function requireSettingReadAccess(c: Context<AppEnv>, names: string[]): Promise<void> {
  if (!names.some(isAdminOnlySettingKey)) {
    return;
  }

  await requireAdmin(c, async () => {});
}

function isAdminOnlySettingKey(name: string): boolean {
  const normalized = normalizeSettingKey(name);
  return normalized === "NOTIFICATION";
}

function requireSupportedSettingKeys(names: string[]): void {
  for (const name of names) {
    const normalized = normalizeSettingKey(name);
    if (!isSupportedSettingKey(normalized)) {
      throw new HttpError(400, "bad_request", `Unsupported instance setting: ${normalized}`);
    }
  }
}

function isSupportedSettingKey(normalized: string): boolean {
  return normalized === "GENERAL" || normalized === "MEMO_RELATED" || normalized === "TAGS" || normalized === "NOTIFICATION";
}

function normalizeSettingKey(name: string): string {
  const lastSegment = name.split("/").pop() ?? name;
  return lastSegment.trim().toUpperCase();
}

function redactSettingForResponse(setting: SystemSetting): SystemSetting {
  if (!isAdminOnlySettingKey(setting.name)) {
    return setting;
  }

  return {
    ...setting,
    value: redactSecrets(setting.value)
  };
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretSettingField(key)) {
      continue;
    }
    redacted[key] = redactSecrets(entry);
  }
  return redacted;
}

function isSecretSettingField(key: string): boolean {
  return (
    key === "smtpPassword" ||
    key === "smtp_password" ||
    key === "accessKeySecret" ||
    key === "access_key_secret" ||
    key === "apiKey" ||
    key === "api_key"
  );
}

function parseSettingNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "bad_request", "names must be an array");
  }
  if (value.length > 100) {
    throw new HttpError(400, "bad_request", "Too many instance setting names");
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new HttpError(400, "bad_request", "names must contain non-empty strings");
    }
    return entry.trim();
  });
}

async function readOptionalJsonObject(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.trim() === "") {
    return {};
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (_error) {
    throw new HttpError(400, "bad_request", "Expected a JSON object body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "bad_request", "Expected a JSON object body");
  }
  return body as Record<string, unknown>;
}

async function resolveTestEmailSetting(c: Context<AppEnv>, requestEmail: unknown) {
  if (requestEmail !== undefined && requestEmail !== null) {
    return parseNotificationEmailSetting(requestEmail);
  }

  const setting = (await getSystemSetting(c.env.DB, "NOTIFICATION")) ?? (await getSystemSetting(c.env.DB, "notification"));
  const email = extractNotificationEmailSetting(setting?.value);
  if (!email) {
    throw new HttpError(400, "bad_request", "Notification email setting is not configured");
  }
  return email;
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "bad_request", `${field} must be a string`);
  }
  return value;
}
