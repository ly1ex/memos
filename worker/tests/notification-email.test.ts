import { describe, expect, it } from "vitest";

import type { Env, SendEmailMessage } from "../src/env";
import { HttpError } from "../src/http/errors";
import { extractNotificationEmailSetting, sendNotificationEmail } from "../src/email/notification";

describe("notification email", () => {
  it("sends through the Cloudflare Email binding", async () => {
    const sent: SendEmailMessage[] = [];
    const env = {
      DB: {} as D1Database,
      ATTACHMENTS: {} as R2Bucket,
      EMAIL: {
        send: async (message: SendEmailMessage) => {
          sent.push(message);
          return { messageId: "msg_123" };
        }
      }
    } satisfies Env;

    const messageId = await sendNotificationEmail(env, {
      email: {
        fromEmail: "noreply@example.com",
        fromName: "Memos",
        replyTo: "support@example.com"
      },
      to: "user@example.com",
      subject: "Test",
      text: "Body"
    });

    expect(messageId).toBe("msg_123");
    expect(sent).toEqual([
      {
        to: "user@example.com",
        from: {
          email: "noreply@example.com",
          name: "Memos"
        },
        subject: "Test",
        text: "Body",
        replyTo: "support@example.com"
      }
    ]);
  });

  it("requires the EMAIL binding", async () => {
    await expect(
      sendNotificationEmail({} as Env, {
        email: {
          fromEmail: "noreply@example.com"
        },
        to: "user@example.com",
        subject: "Test",
        text: "Body"
      })
    ).rejects.toMatchObject({
      status: 500,
      code: "internal",
      message: "Cloudflare Email binding EMAIL is not configured"
    } satisfies Partial<HttpError>);
  });

  it("extracts the email setting from notification settings", () => {
    expect(
      extractNotificationEmailSetting({
        email: {
          enabled: true,
          fromEmail: "noreply@example.com"
        }
      })
    ).toEqual({
      enabled: true,
      fromEmail: "noreply@example.com"
    });

    expect(
      extractNotificationEmailSetting({
        notificationSetting: {
          email: {
            fromEmail: "worker@example.com"
          }
        }
      })
    ).toEqual({
      fromEmail: "worker@example.com"
    });
  });

  it("validates sender and recipient addresses before sending", async () => {
    const env = {
      DB: {} as D1Database,
      ATTACHMENTS: {} as R2Bucket,
      EMAIL: {
        send: async () => ({ messageId: "unused" })
      }
    } satisfies Env;

    await expect(
      sendNotificationEmail(env, {
        email: {
          fromEmail: "not-an-email"
        },
        to: "user@example.com",
        subject: "Test",
        text: "Body"
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
      message: "fromEmail is invalid"
    } satisfies Partial<HttpError>);
  });
});
