import type { Env, SendEmailAddress } from "../env";
import { HttpError } from "../http/errors";

export interface NotificationEmailSetting {
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  useTls?: boolean;
  useSsl?: boolean;
}

export interface NotificationEmailInput {
  email: NotificationEmailSetting;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function extractNotificationEmailSetting(value: unknown): NotificationEmailSetting | null {
  if (!isRecord(value)) {
    return null;
  }

  if (isRecord(value.email)) {
    return parseNotificationEmailSetting(value.email);
  }

  if (isRecord(value.notificationSetting) && isRecord(value.notificationSetting.email)) {
    return parseNotificationEmailSetting(value.notificationSetting.email);
  }

  return null;
}

export function parseNotificationEmailSetting(value: unknown): NotificationEmailSetting {
  if (!isRecord(value)) {
    throw new HttpError(400, "bad_request", "email must be an object");
  }

  return {
    enabled: readOptionalBoolean(value.enabled, "enabled"),
    smtpHost: readOptionalString(value.smtpHost, "smtpHost"),
    smtpPort: readOptionalNumber(value.smtpPort, "smtpPort"),
    smtpUsername: readOptionalString(value.smtpUsername, "smtpUsername"),
    smtpPassword: readOptionalString(value.smtpPassword, "smtpPassword"),
    fromEmail: readOptionalString(value.fromEmail, "fromEmail"),
    fromName: readOptionalString(value.fromName, "fromName"),
    replyTo: readOptionalString(value.replyTo, "replyTo"),
    useTls: readOptionalBoolean(value.useTls, "useTls"),
    useSsl: readOptionalBoolean(value.useSsl, "useSsl")
  };
}

export async function sendNotificationEmail(env: Env, input: NotificationEmailInput): Promise<string> {
  if (!env.EMAIL) {
    throw new HttpError(500, "internal", "Cloudflare Email binding EMAIL is not configured");
  }

  const fromEmail = normalizeEmail(input.email.fromEmail, "fromEmail");
  const to = normalizeEmail(input.to, "recipientEmail");
  const from = addressWithOptionalName(fromEmail, input.email.fromName);
  const replyTo = optionalEmail(input.email.replyTo, "replyTo");

  try {
    const result = await env.EMAIL.send({
      to,
      from,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo
    });
    return result.messageId;
  } catch (error) {
    throw mapEmailSendError(error);
  }
}

function addressWithOptionalName(email: string, name: string | undefined): SendEmailAddress {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return email;
  }
  return {
    email,
    name: trimmedName
  };
}

function optionalEmail(value: string | undefined, field: string): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return normalizeEmail(value, field);
}

function normalizeEmail(value: string | undefined, field: string): string {
  const email = value?.trim() ?? "";
  if (!email) {
    throw new HttpError(400, "bad_request", `${field} is required`);
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new HttpError(400, "bad_request", `${field} is invalid`);
  }
  return email;
}

function mapEmailSendError(error: unknown): HttpError {
  const record = isRecord(error) ? error : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message = error instanceof Error ? error.message : "Cloudflare Email send failed";
  const detail = code ? `${code}: ${message}` : message;

  if (code === "E_RATE_LIMIT_EXCEEDED" || code === "E_DAILY_LIMIT_EXCEEDED") {
    return new HttpError(429, "internal", detail);
  }
  if (
    code === "E_VALIDATION_ERROR" ||
    code === "E_FIELD_MISSING" ||
    code === "E_TOO_MANY_RECIPIENTS" ||
    code === "E_SENDER_NOT_VERIFIED" ||
    code === "E_RECIPIENT_NOT_ALLOWED" ||
    code === "E_SENDER_DOMAIN_NOT_AVAILABLE" ||
    code === "E_CONTENT_TOO_LARGE"
  ) {
    return new HttpError(400, "bad_request", detail);
  }
  return new HttpError(500, "internal", detail);
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

function readOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number") {
    throw new HttpError(400, "bad_request", `${field} must be a number`);
  }
  return value;
}

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, "bad_request", `${field} must be a boolean`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
