import { describe, expect, it } from "vitest";

import { toMemoShareResponse } from "../src/serializers/shares";

describe("share serializer", () => {
  it("builds public share URLs", () => {
    expect(
      toMemoShareResponse({
        id: 1,
        memoId: 2,
        creatorId: 3,
        shareId: "share_abc",
        createdTs: 10,
        updatedTs: 20
      })
    ).toMatchObject({
      id: 1,
      memoId: 2,
      shareId: "share_abc",
      createdTs: 10,
      updatedTs: 20,
      url: "/api/v1/shares/share_abc"
    });
  });
});
