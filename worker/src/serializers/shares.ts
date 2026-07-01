import type { MemoShare } from "../repositories/memo-shares";

export interface MemoShareResponse {
  id: number;
  memoId: number;
  shareId: string;
  expiresTs?: number;
  createdTs: number;
  updatedTs: number;
  url: string;
}

export function toMemoShareResponse(share: MemoShare): MemoShareResponse {
  return {
    id: share.id,
    memoId: share.memoId,
    shareId: share.shareId,
    expiresTs: share.expiresTs,
    createdTs: share.createdTs,
    updatedTs: share.updatedTs,
    url: `/api/v1/shares/${share.shareId}`
  };
}

