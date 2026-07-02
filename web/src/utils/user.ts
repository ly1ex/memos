import { User, User_Role } from "@/api/types";

export const isSuperUser = (user: User | undefined) => {
  return user && user.role === User_Role.ADMIN;
};
