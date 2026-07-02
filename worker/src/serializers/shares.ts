import type { MemoShare } from "../repositories/memo-shares";
import { timestampFromUnix } from "../utils/rest-json";
import { memoName } from "../utils/resource-names";

export interface MemoShareResponse {
  id: number;
  name: string;
  memoId: number;
  memo?: string;
  shareId: string;
  expiresTs?: number;
  createdTs: number;
  updatedTs: number;
  createTime: string;
  updateTime: string;
  url: string;
}

export function toMemoShareResponse(share: MemoShare): MemoShareResponse {
  return {
    id: share.id,
    name: `memos/${share.memoId}/shares/${share.shareId}`,
    memoId: share.memoId,
    memo: share.memoUid ? memoName(share.memoUid) : undefined,
    shareId: share.shareId,
    expiresTs: share.expiresTs,
    createdTs: share.createdTs,
    updatedTs: share.updatedTs,
    createTime: timestampFromUnix(share.createdTs),
    updateTime: timestampFromUnix(share.updatedTs),
    url: `/api/v1/shares/${share.shareId}`
  };
}
