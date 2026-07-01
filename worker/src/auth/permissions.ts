import type { LocalUser } from "../env";

export function isAdmin(user: LocalUser): boolean {
  return user.role === "ADMIN";
}

export function canReadOwnedResource(user: LocalUser, creatorId: number): boolean {
  return isAdmin(user) || user.id === creatorId;
}

export function canWriteOwnedResource(user: LocalUser, creatorId: number): boolean {
  return isAdmin(user) || user.id === creatorId;
}

export function assertAdmin(user: LocalUser): void {
  if (!isAdmin(user)) {
    throw new Error("admin_required");
  }
}
