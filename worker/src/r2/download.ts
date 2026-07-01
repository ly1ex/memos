import type { Attachment } from "../repositories/attachments";
import { contentDispositionInline } from "../utils/filename";

export async function getAttachmentObject(bucket: R2Bucket, attachment: Attachment, rangeHeaders: Headers): Promise<Response | null> {
  const object = await bucket.get(attachment.r2Key, {
    range: rangeHeaders
  });

  if (!object) {
    return null;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("content-disposition", contentDispositionInline(attachment.filename));

  const range = object.range;
  if (range) {
    const { start, end, length } = resolveRange(object.size, range);
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, {
      status: 206,
      headers
    });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, {
    headers
  });
}

function resolveRange(size: number, range: R2Range): { start: number; end: number; length: number } {
  if ("suffix" in range) {
    const length = Math.min(range.suffix, size);
    const start = Math.max(size - length, 0);
    return {
      start,
      end: size - 1,
      length
    };
  }

  const explicitLength = "length" in range ? range.length : undefined;
  const start = range.offset ?? Math.max(size - (explicitLength ?? size), 0);
  const length = explicitLength ?? Math.max(size - start, 0);
  return {
    start,
    end: Math.min(start + length - 1, size - 1),
    length
  };
}
