import { describe, expect, it } from "vitest";

import { buildMemoPayload } from "../src/domain/memo-payload";

describe("memo payload", () => {
  it("extracts unique sorted tags", () => {
    expect(buildMemoPayload("hello #work #memos and #work again")).toEqual({
      entryType: "MEMO",
      tags: ["memos", "work"]
    });
  });

  it("ignores invalid tag starts", () => {
    expect(buildMemoPayload("email test#a and #/bad")).toEqual({
      entryType: "MEMO",
      tags: []
    });
  });

  it("keeps explicit entry type", () => {
    expect(buildMemoPayload("today", "DIARY")).toEqual({
      entryType: "DIARY",
      tags: []
    });
  });
});
