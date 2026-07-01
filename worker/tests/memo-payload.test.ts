import { describe, expect, it } from "vitest";

import { buildMemoPayload } from "../src/domain/memo-payload";

describe("memo payload", () => {
  it("extracts unique sorted tags", () => {
    expect(buildMemoPayload("hello #work #memos and #work again")).toEqual({
      tags: ["memos", "work"]
    });
  });

  it("ignores invalid tag starts", () => {
    expect(buildMemoPayload("email test#a and #/bad")).toEqual({
      tags: []
    });
  });
});

