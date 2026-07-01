import { describe, expect, it } from "vitest";

import { canReadMemo, canWriteMemo } from "../src/auth/memo-access";
import type { AuthContext, LocalUser } from "../src/env";
import type { Memo } from "../src/repositories/memos";

const owner = {
  id: 1,
  clerkUserId: "user_1",
  username: "owner",
  email: "",
  nickname: "",
  avatarUrl: "",
  role: "USER",
  rowStatus: "NORMAL",
  createdTs: 1,
  updatedTs: 1
} satisfies LocalUser;

const other = {
  ...owner,
  id: 2,
  clerkUserId: "user_2",
  username: "other"
} satisfies LocalUser;

const admin = {
  ...owner,
  id: 3,
  clerkUserId: "user_3",
  username: "admin",
  role: "ADMIN"
} satisfies LocalUser;

const baseMemo = {
  id: 1,
  uid: "memo_1",
  creatorId: owner.id,
  content: "hello",
  visibility: "PRIVATE",
  rowStatus: "NORMAL",
  pinned: false,
  payload: {},
  createdTs: 1,
  updatedTs: 1
} satisfies Memo;

describe("memo access", () => {
  it("allows anonymous reads for public memos", () => {
    expect(canReadMemo(null, { ...baseMemo, visibility: "PUBLIC" })).toBe(true);
  });

  it("requires auth for protected memos", () => {
    expect(canReadMemo(null, { ...baseMemo, visibility: "PROTECTED" })).toBe(false);
    expect(canReadMemo(authFor(other), { ...baseMemo, visibility: "PROTECTED" })).toBe(true);
  });

  it("restricts private memos to owner and admin", () => {
    expect(canReadMemo(authFor(other), baseMemo)).toBe(false);
    expect(canReadMemo(authFor(owner), baseMemo)).toBe(true);
    expect(canReadMemo(authFor(admin), baseMemo)).toBe(true);
  });

  it("restricts writes to owner and admin", () => {
    expect(canWriteMemo(authFor(other), baseMemo)).toBe(false);
    expect(canWriteMemo(authFor(owner), baseMemo)).toBe(true);
    expect(canWriteMemo(authFor(admin), baseMemo)).toBe(true);
  });
});

function authFor(localUser: LocalUser): AuthContext {
  return {
    clerkUserId: localUser.clerkUserId,
    localUser
  };
}

