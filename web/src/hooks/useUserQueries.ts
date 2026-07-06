import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shortcutApi, userApi } from "@/api/client";
import {
  createMessage,
  FieldMaskSchema,
  type ListAllUserStatsRequest,
  ListAllUserStatsRequestSchema,
  User,
  UserSetting,
  UserSetting_GeneralSetting,
  UserSetting_Key,
  UserSettingSchema,
  UserStats,
} from "@/api/types";
import { buildUserSettingName } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";

const BATCH_GET_USERS_LIMIT = 100;
type ListAllUserStatsQuery = Pick<ListAllUserStatsRequest, "state" | "filter">;

// Query keys factory
export const userKeys = {
  all: ["users"] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (name: string) => [...userKeys.details(), name] as const,
  stats: () => [...userKeys.all, "stats"] as const,
  userStats: (name: string) => [...userKeys.stats(), name] as const,
  allUserStats: (request: Partial<ListAllUserStatsQuery>) => [...userKeys.stats(), "all", request] as const,
  currentUser: () => [...userKeys.all, "current"] as const,
  shortcuts: () => [...userKeys.all, "shortcuts"] as const,
  notifications: () => [...userKeys.all, "notifications"] as const,
  byNames: (names: string[]) => [...userKeys.all, "byNames", ...[...names].sort()] as const,
  byUsernames: (usernames: string[]) => [...userKeys.all, "byUsernames", ...[...usernames].sort()] as const,
};

export function useUser(name: string, options?: { enabled?: boolean }) {
  const currentUser = useCurrentUser();

  return useQuery({
    queryKey: userKeys.detail(name),
    queryFn: async () => {
      const user = await userApi.getUser({ name });
      return user;
    },
    select: (user) => (currentUser?.name === user.name ? currentUser : user),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes - user profiles don't change often
  });
}

export function useUserStats(username?: string) {
  return useQuery({
    queryKey: username ? userKeys.userStats(username) : userKeys.stats(),
    queryFn: async () => {
      if (!username) {
        throw new Error("Username is required");
      }
      const stats = await userApi.getUserStats({ name: username });
      return stats;
    },
    enabled: !!username,
  });
}

export function useAllUserStats(request: Partial<ListAllUserStatsQuery> = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.allUserStats(request),
    queryFn: async () => {
      const { stats } = await userApi.listAllUserStats(createMessage(ListAllUserStatsRequestSchema, request));
      return stats;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useShortcuts() {
  return useQuery({
    queryKey: userKeys.shortcuts(),
    queryFn: async () => {
      const { shortcuts } = await shortcutApi.listShortcuts({});
      return shortcuts;
    },
  });
}

export function useNotifications() {
  const currentUser = useCurrentUser();

  return useQuery({
    queryKey: userKeys.notifications(),
    queryFn: async () => {
      if (!currentUser?.name) {
        return [];
      }
      const { notifications } = await userApi.listUserNotifications({ parent: currentUser.name });
      return notifications;
    },
    enabled: !!currentUser?.name,
    staleTime: 1000 * 30, // 30 seconds - notifications should update frequently
  });
}

export function useTagCounts(forCurrentUser = false) {
  const currentUser = useCurrentUser();

  return useQuery<UserStats | Record<string, number>, Error, Record<string, number>>({
    queryKey:
      forCurrentUser && currentUser?.name
        ? userKeys.userStats(currentUser.name)
        : [...userKeys.stats(), "tagCounts", forCurrentUser ? "current" : "all"],
    queryFn: async (): Promise<UserStats | Record<string, number>> => {
      if (forCurrentUser) {
        if (!currentUser?.name) {
          return {};
        }
        return userApi.getUserStats({ name: currentUser.name });
      } else {
        // Fetch all user stats
        const { stats } = await userApi.listAllUserStats({});

        // Aggregate tag counts from all users
        const tagCount: Record<string, number> = {};
        for (const userStats of stats) {
          if (userStats.tagCount) {
            for (const [tag, count] of Object.entries(userStats.tagCount)) {
              tagCount[tag] = (tagCount[tag] || 0) + Number(count);
            }
          }
        }
        return tagCount;
      }
    },
    select: (data) => {
      if (forCurrentUser) {
        return (data as UserStats).tagCount || {};
      }
      return data as Record<string, number>;
    },
    enabled: !forCurrentUser || !!currentUser?.name,
    staleTime: 1000 * 60 * 2, // 2 minutes - tags don't change frequently
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user, updateMask }: { user: Partial<User>; updateMask: string[] }) => {
      const updatedUser = await userApi.updateUser({
        user: user as User,
        updateMask: createMessage(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(userKeys.detail(updatedUser.name), updatedUser);
      queryClient.invalidateQueries({ queryKey: userKeys.currentUser() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await userApi.deleteUser({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: userKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

// Hook to fetch user settings
export function useUserSettings(parent?: string) {
  return useQuery({
    queryKey: [...userKeys.all, "settings", parent],
    queryFn: async () => {
      if (!parent) return { settings: [], shortcuts: [] };
      const [{ settings }, { shortcuts }] = await Promise.all([
        userApi.listUserSettings({ parent }),
        shortcutApi.listShortcuts({ parent }),
      ]);
      return { settings, shortcuts };
    },
    enabled: !!parent,
  });
}

// Hook to update user setting
export function useUpdateUserSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ setting, updateMask }: { setting: UserSetting; updateMask: string[] }) => {
      const updatedSetting = await userApi.updateUserSetting({
        setting,
        updateMask: createMessage(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...userKeys.all, "settings"] });
    },
  });
}

// Hook to list all users
export function useListUsers() {
  const currentUser = useCurrentUser();

  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => {
      const { users } = await userApi.listUsers({});
      return users;
    },
    select: (users) => users.map((user) => (currentUser?.name === user.name ? currentUser : user)),
  });
}

// Hook to update user general setting (convenience wrapper)
export function useUpdateUserGeneralSetting(currentUserName?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ generalSetting, updateMask }: { generalSetting: Partial<UserSetting_GeneralSetting>; updateMask: string[] }) => {
      if (!currentUserName) {
        throw new Error("No current user");
      }

      const settingName = buildUserSettingName(currentUserName, UserSetting_Key.GENERAL);
      const userSetting = createMessage(UserSettingSchema, {
        name: settingName,
        value: {
          case: "generalSetting",
          value: generalSetting as UserSetting_GeneralSetting,
        },
      });

      const updatedSetting = await userApi.updateUserSetting({
        setting: userSetting,
        updateMask: createMessage(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...userKeys.all, "settings"] });
    },
  });
}

// Hook to fetch multiple users by names (returns Map<name, User>)
export function useUsersByNames(names: string[]) {
  const currentUser = useCurrentUser();
  const enabled = names.length > 0;
  const uniqueNames = Array.from(new Set(names));

  return useQuery({
    queryKey: userKeys.byNames(uniqueNames),
    queryFn: async () => {
      const users = await Promise.all(
        uniqueNames.map(async (name) => {
          try {
            const user = await userApi.getUser({ name });
            return { name, user };
          } catch {
            return { name, user: undefined };
          }
        }),
      );

      const userMap = new Map<string, User | undefined>();
      for (const { name, user } of users) {
        userMap.set(name, user);
      }
      return userMap;
    },
    enabled,
    select: (userMap) => {
      if (!currentUser?.name || !userMap.has(currentUser.name)) {
        return userMap;
      }
      const nextUserMap = new Map(userMap);
      nextUserMap.set(currentUser.name, currentUser);
      return nextUserMap;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - user profiles don't change often
  });
}

// Hook to fetch multiple users by usernames (returns Map<username, User>)
export function useUsersByUsernames(usernames: string[], options?: { enabled?: boolean }) {
  const currentUser = useCurrentUser();
  const enabled = (options?.enabled ?? true) && usernames.length > 0;
  const uniqueUsernames = Array.from(new Set(usernames));

  return useQuery({
    queryKey: userKeys.byUsernames(uniqueUsernames),
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < uniqueUsernames.length; i += BATCH_GET_USERS_LIMIT) {
        batches.push(uniqueUsernames.slice(i, i + BATCH_GET_USERS_LIMIT));
      }

      const responses = await Promise.all(batches.map((batch) => userApi.batchGetUsers({ usernames: batch })));
      const usersByUsername = new Map(responses.flatMap((response) => response.users).map((user) => [user.username, user] as const));

      const userMap = new Map<string, User | undefined>();
      for (const username of uniqueUsernames) {
        userMap.set(username, usersByUsername.get(username));
      }
      return userMap;
    },
    enabled,
    select: (userMap) => {
      if (!currentUser?.username || !userMap.has(currentUser.username)) {
        return userMap;
      }
      const nextUserMap = new Map(userMap);
      nextUserMap.set(currentUser.username, currentUser);
      return nextUserMap;
    },
    staleTime: 1000 * 60 * 5,
  });
}
