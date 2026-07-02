import { describe, expect, it } from "vitest";

import type { AuthContext, LocalUser } from "../src/env";
import { toUserResponse } from "../src/serializers/users";

const target = user({ id: 1, username: "target", email: "target@example.com", role: "USER" });
const other = user({ id: 2, username: "other", email: "other@example.com", role: "USER" });
const admin = user({ id: 3, username: "admin", email: "admin@example.com", role: "ADMIN" });

describe("user serializer", () => {
  it("redacts email for anonymous and unrelated regular users", () => {
    expect(toUserResponse(target).email).toBe("");
    expect(toUserResponse(target, authFor(other)).email).toBe("");
  });

  it("returns email for the same user and admins", () => {
    expect(toUserResponse(target, authFor(target)).email).toBe("target@example.com");
    expect(toUserResponse(target, authFor(admin)).email).toBe("target@example.com");
  });
});

function authFor(localUser: LocalUser): AuthContext {
  return {
    clerkUserId: localUser.clerkUserId,
    localUser
  };
}

function user(input: { id: number; username: string; email: string; role: "ADMIN" | "USER" }): LocalUser {
  return {
    id: input.id,
    clerkUserId: `clerk_${input.id}`,
    username: input.username,
    email: input.email,
    nickname: input.username,
    avatarUrl: "",
    role: input.role,
    rowStatus: "NORMAL",
    createdTs: 1,
    updatedTs: 1
  };
}
