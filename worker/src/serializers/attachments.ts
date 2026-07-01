import type { Attachment } from "../repositories/attachments";

export interface AttachmentResponse {
  id: number;
  uid: string;
  memoId?: number;
  filename: string;
  type: string;
  size: number;
  sha256: string;
  metadata: unknown;
  createdTs: number;
  updatedTs: number;
  downloadUrl: string;
}

export function toAttachmentResponse(attachment: Attachment): AttachmentResponse {
  return {
    id: attachment.id,
    uid: attachment.uid,
    memoId: attachment.memoId,
    filename: attachment.filename,
    type: attachment.type,
    size: attachment.size,
    sha256: attachment.sha256,
    metadata: attachment.metadata,
    createdTs: attachment.createdTs,
    updatedTs: attachment.updatedTs,
    downloadUrl: `/file/attachments/${attachment.uid}/${encodeURIComponent(attachment.filename)}`
  };
}

