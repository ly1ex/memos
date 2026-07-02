import { canReadOwnedResource } from "../auth/permissions";
import type { AuthContext, LocalUser } from "../env";
import { stateFromRowStatus, timestampFromUnix } from "../utils/rest-json";
import { userName } from "../utils/resource-names";

export interface UserResponse {
  id: number;
  name: string;
  username: string;
  email: string;
  nickname: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  rowStatus: string;
  state: string;
  createdTs: number;
  updatedTs: number;
  createTime: string;
  updateTime: string;
}

export function toUserResponse(user: LocalUser, viewer?: AuthContext | null): UserResponse {
  const canReadEmail = viewer ? canReadOwnedResource(viewer.localUser, user.id) : false;
  return {
    id: user.id,
    name: userName(user.username),
    username: user.username,
    email: canReadEmail ? user.email : "",
    nickname: user.nickname,
    displayName: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    rowStatus: user.rowStatus,
    state: stateFromRowStatus(user.rowStatus),
    createdTs: user.createdTs,
    updatedTs: user.updatedTs,
    createTime: timestampFromUnix(user.createdTs),
    updateTime: timestampFromUnix(user.updatedTs)
  };
}
