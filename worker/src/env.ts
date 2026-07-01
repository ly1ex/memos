export interface Env {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  CORS_ORIGINS?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
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

