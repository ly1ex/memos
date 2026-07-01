import type { AuthContext } from "../env";
import type { Memo } from "../repositories/memos";
import { canReadOwnedResource, canWriteOwnedResource } from "./permissions";

export function canReadMemo(auth: AuthContext | null, memo: Memo): boolean {
  if (memo.visibility === "PUBLIC") {
    return true;
  }

  if (!auth) {
    return false;
  }

  if (memo.visibility === "PROTECTED") {
    return true;
  }

  return canReadOwnedResource(auth.localUser, memo.creatorId);
}

export function canWriteMemo(auth: AuthContext, memo: Memo): boolean {
  return canWriteOwnedResource(auth.localUser, memo.creatorId);
}

