import { describe, expect, it } from "vitest";

import { HttpError } from "../src/http/errors";
import { clampPageSize, decodeCreatedCursor, encodeCreatedCursor, pageFromLimit } from "../src/repositories/cursor";

describe("cursor helpers", () => {
  it("encodes and decodes created cursors", () => {
    const cursor = encodeCreatedCursor({ createdTs: 123, id: 45 });

    expect(decodeCreatedCursor(cursor)).toEqual({ createdTs: 123, id: 45 });
  });

  it("rejects invalid cursors", () => {
    expect(() => decodeCreatedCursor("not-base64")).toThrow(HttpError);
  });

  it("clamps page size", () => {
    expect(clampPageSize(null)).toBe(20);
    expect(clampPageSize("500", 20, 100)).toBe(100);
  });

  it("returns a next cursor when extra rows exist", () => {
    const page = pageFromLimit(
      [
        { id: 3, createdTs: 30 },
        { id: 2, createdTs: 20 },
        { id: 1, createdTs: 10 }
      ],
      2
    );

    expect(page.items).toEqual([
      { id: 3, createdTs: 30 },
      { id: 2, createdTs: 20 }
    ]);
    expect(decodeCreatedCursor(page.nextCursor ?? null)).toEqual({ id: 2, createdTs: 20 });
  });
});

