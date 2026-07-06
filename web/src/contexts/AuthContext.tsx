import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, shortcutApi, userApi } from "@/api/client";
import { ApiError, ApiErrorCode } from "@/api/errors";
import type { Shortcut, User, UserSetting_GeneralSetting, UserSetting_TagsSetting, UserSetting_WebhooksSetting } from "@/api/types";
import { type ClerkProfileData, isClerkEnabled, useClerkProfile } from "@/clerk-auth";
import { userKeys } from "@/hooks/useUserQueries";

interface AuthState {
  currentUser: User | undefined;
  userGeneralSetting: UserSetting_GeneralSetting | undefined;
  userWebhooksSetting: UserSetting_WebhooksSetting | undefined;
  userTagsSetting: UserSetting_TagsSetting | undefined;
  shortcuts: Shortcut[];
  isInitialized: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  refetchSettings: () => Promise<void>;
  setCurrentUser: (user: User | undefined) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyClerkProfile(user: User, profile: ClerkProfileData | null): User {
  if (!isClerkEnabled || !profile) {
    return user;
  }

  return {
    ...user,
    email: profile.email,
    displayName: profile.displayName,
    displayUsername: profile.username || user.username,
    avatarUrl: profile.avatarUrl,
  };
}

function hasSameClerkBackedProfile(left: User, right: User): boolean {
  return (
    left.email === right.email &&
    left.displayName === right.displayName &&
    left.displayUsername === right.displayUsername &&
    left.avatarUrl === right.avatarUrl
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const clerkProfile = useClerkProfile();
  const initializeRequestRef = useRef(0);
  const [state, setState] = useState<AuthState>({
    currentUser: undefined,
    userGeneralSetting: undefined,
    userWebhooksSetting: undefined,
    userTagsSetting: undefined,
    shortcuts: [],
    isInitialized: false,
    isLoading: true,
  });

  const fetchUserSettings = useCallback(async (userName: string) => {
    const [{ settings }, { shortcuts }] = await Promise.all([
      userApi.listUserSettings({ parent: userName }),
      shortcutApi.listShortcuts({ parent: userName }),
    ]);

    const generalSetting = settings.find((s) => s.value.case === "generalSetting");
    const webhooksSetting = settings.find((s) => s.value.case === "webhooksSetting");
    const tagsSetting = settings.find((s) => s.value.case === "tagsSetting");

    return {
      userGeneralSetting: generalSetting?.value.case === "generalSetting" ? generalSetting.value.value : undefined,
      userWebhooksSetting: webhooksSetting?.value.case === "webhooksSetting" ? webhooksSetting.value.value : undefined,
      userTagsSetting: tagsSetting?.value.case === "tagsSetting" ? tagsSetting.value.value : undefined,
      shortcuts,
    };
  }, []);

  const initialize = useCallback(async () => {
    const requestId = ++initializeRequestRef.current;
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { user: localCurrentUser } = await authApi.getCurrentUser({});

      if (!localCurrentUser) {
        if (requestId !== initializeRequestRef.current) return;
        setState({
          currentUser: undefined,
          userGeneralSetting: undefined,
          userWebhooksSetting: undefined,
          userTagsSetting: undefined,
          shortcuts: [],
          isInitialized: true,
          isLoading: false,
        });
        return;
      }

      const currentUser = applyClerkProfile(localCurrentUser, clerkProfile);
      const settings = await fetchUserSettings(currentUser.name);

      if (requestId !== initializeRequestRef.current) return;
      setState({
        currentUser,
        ...settings,
        isInitialized: true,
        isLoading: false,
      });

      // Pre-populate React Query cache
      queryClient.setQueryData(userKeys.currentUser(), currentUser);
      queryClient.setQueryData(userKeys.detail(currentUser.name), currentUser);
    } catch (error) {
      if (requestId !== initializeRequestRef.current) return;
      if (!(error instanceof ApiError) || error.code !== ApiErrorCode.Unauthenticated) {
        console.error("Failed to initialize auth:", error);
      }
      setState({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userWebhooksSetting: undefined,
        userTagsSetting: undefined,
        shortcuts: [],
        isInitialized: true,
        isLoading: false,
      });
    }
  }, [clerkProfile, fetchUserSettings, queryClient]);

  useEffect(() => {
    if (!isClerkEnabled || !clerkProfile) {
      return;
    }

    setState((prev) => {
      if (!prev.currentUser) {
        return prev;
      }

      const nextCurrentUser = applyClerkProfile(prev.currentUser, clerkProfile);
      if (hasSameClerkBackedProfile(prev.currentUser, nextCurrentUser)) {
        return prev;
      }

      queryClient.setQueryData(userKeys.currentUser(), nextCurrentUser);
      queryClient.setQueryData(userKeys.detail(nextCurrentUser.name), nextCurrentUser);
      return { ...prev, currentUser: nextCurrentUser };
    });
  }, [clerkProfile, queryClient]);

  const logout = useCallback(async () => {
    initializeRequestRef.current += 1;
    try {
      await authApi.signOut({});
    } catch (error) {
      console.error("[AuthContext] Failed to sign out:", error);
    } finally {
      setState({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userWebhooksSetting: undefined,
        userTagsSetting: undefined,
        shortcuts: [],
        isInitialized: true,
        isLoading: false,
      });
      queryClient.clear();
    }
  }, [queryClient]);

  const refetchSettings = useCallback(async () => {
    const currentUserName = state.currentUser?.name;
    if (!currentUserName) {
      return;
    }

    const settings = await fetchUserSettings(currentUserName);
    setState((prev) => {
      if (prev.currentUser?.name !== currentUserName) {
        return prev;
      }
      return { ...prev, ...settings };
    });
  }, [fetchUserSettings, state.currentUser?.name]);

  // Sync the updated user to AuthContext and React Query cache after profile changes
  const setCurrentUser = useCallback(
    (user: User | undefined) => {
      const previousUser = queryClient.getQueryData<User>(userKeys.currentUser());
      const nextUser = user ? applyClerkProfile(user, clerkProfile) : undefined;
      setState((prev) => ({ ...prev, currentUser: nextUser }));
      if (nextUser) {
        queryClient.setQueryData(userKeys.currentUser(), nextUser);
        queryClient.setQueryData(userKeys.detail(nextUser.name), nextUser);
      } else {
        queryClient.removeQueries({ queryKey: userKeys.currentUser(), exact: true });
        if (previousUser?.name) {
          queryClient.removeQueries({ queryKey: userKeys.detail(previousUser.name), exact: true });
        }
      }
    },
    [clerkProfile, queryClient],
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      ...state,
      initialize,
      logout,
      refetchSettings,
      setCurrentUser,
    }),
    [state, initialize, logout, refetchSettings, setCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Convenience hook for just the current user
export function useCurrentUserFromAuth() {
  const { currentUser } = useAuth();
  return currentUser;
}
