import type { Attachment } from "../repositories/attachments";
import { timestampFromUnix } from "../utils/rest-json";
import { attachmentName, memoName } from "../utils/resource-names";

export interface AttachmentResponse {
  id: number;
  name: string;
  uid: string;
  memoId?: number;
  memo?: string;
  filename: string;
  type: string;
  size: number;
  sha256: string;
  metadata: unknown;
  createdTs: number;
  updatedTs: number;
  createTime: string;
  updateTime: string;
  downloadUrl: string;
}

export function toAttachmentResponse(attachment: Attachment): AttachmentResponse {
  return {
    id: attachment.id,
    name: attachmentName(attachment.uid),
    uid: attachment.uid,
    memoId: attachment.memoId,
    memo: attachment.memoUid ? memoName(attachment.memoUid) : undefined,
    filename: attachment.filename,
    type: attachment.type,
    size: attachment.size,
    sha256: attachment.sha256,
    metadata: attachment.metadata,
    createdTs: attachment.createdTs,
    updatedTs: attachment.updatedTs,
    createTime: timestampFromUnix(attachment.createdTs),
    updateTime: timestampFromUnix(attachment.updatedTs),
    downloadUrl: `/file/attachments/${attachment.uid}/${encodeURIComponent(attachment.filename)}`
  };
}
