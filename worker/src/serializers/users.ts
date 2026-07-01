import type { LocalUser } from "../env";

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: string;
  rowStatus: string;
  createdTs: number;
  updatedTs: number;
}

export function toUserResponse(user: LocalUser): UserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    rowStatus: user.rowStatus,
    createdTs: user.createdTs,
    updatedTs: user.updatedTs
  };
}

