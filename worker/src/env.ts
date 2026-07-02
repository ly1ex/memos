export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  EMAIL?: SendEmailBinding;
  CORS_ORIGINS?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
}

export type SendEmailAddress = string | { email: string; name?: string };

export interface SendEmailMessage {
  to: SendEmailAddress | SendEmailAddress[];
  from: SendEmailAddress;
  subject: string;
  text?: string;
  html?: string;
  cc?: SendEmailAddress | SendEmailAddress[];
  bcc?: SendEmailAddress | SendEmailAddress[];
  replyTo?: SendEmailAddress;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string;
}

export interface SendEmailBinding {
  send(message: SendEmailMessage): Promise<SendEmailResult>;
}

export type UserRole = "ADMIN" | "USER";
export type RowStatus = "NORMAL" | "ARCHIVED";

export interface LocalUser {
  id: number;
  clerkUserId: string;
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: UserRole;
  rowStatus: RowStatus;
  createdTs: number;
  updatedTs: number;
}

export interface AuthContext {
  clerkUserId: string;
  sessionId?: string;
  localUser: LocalUser;
}

export interface Variables {
  auth: AuthContext;
}

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
