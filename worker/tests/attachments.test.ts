import { describe, expect, it } from "vitest";

import { getAttachmentObject } from "../src/r2/download";
import type { Attachment } from "../src/repositories/attachments";
import { toAttachmentResponse } from "../src/serializers/attachments";
import { contentDispositionInline, sanitizeFilename } from "../src/utils/filename";

const attachment = {
  id: 1,
  uid: "att_1",
  creatorId: 1,
  filename: "hello world.txt",
  type: "text/plain",
  size: 10,
  r2Key: "attachments/att_1/hello world.txt",
  r2Bucket: "",
  sha256: "",
  metadata: {},
  createdTs: 1,
  updatedTs: 1
} satisfies Attachment;

describe("attachment helpers", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../weird/name?.png")).toBe("name_.png");
    expect(sanitizeFilename("   ")).toBe("attachment");
  });

  it("formats inline content disposition", () => {
    expect(contentDispositionInline("hello world.txt")).toBe("inline; filename=\"hello world.txt\"; filename*=UTF-8''hello%20world.txt");
  });

  it("does not expose r2Key in API responses", () => {
    const response = toAttachmentResponse(attachment);

    expect(response).toEqual(
      expect.objectContaining({
        uid: "att_1",
        downloadUrl: "/file/attachments/att_1/hello%20world.txt"
      })
    );
    expect("r2Key" in response).toBe(false);
  });

  it("returns range responses from R2 objects", async () => {
    const bucket = {
      get: async () =>
        ({
          body: new ReadableStream(),
          size: 10,
          httpEtag: '"etag"',
          range: { offset: 2, length: 4 },
          writeHttpMetadata: (headers: Headers) => headers.set("content-type", "text/plain")
        }) as R2ObjectBody
    } as unknown as R2Bucket;

    const response = await getAttachmentObject(bucket, attachment, new Headers({ range: "bytes=2-5" }));

    expect(response?.status).toBe(206);
    expect(response?.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response?.headers.get("content-length")).toBe("4");
    expect(response?.headers.get("content-type")).toBe("text/plain");
  });
});
