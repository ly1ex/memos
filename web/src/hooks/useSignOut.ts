import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Routes } from "@/router";

export function useSignOut() {
  const { logout } = useAuth();

  return useCallback(async () => {
    await logout();

    try {
      const keysToPreserve = [
        "memos-theme",
        "memos-locale",
        "memos-view-setting",
        "tag-view-as-tree",
        "tag-tree-auto-expand",
        "lumina.space",
        "lumina.private-entry-type",
      ];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToPreserve.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore localStorage failures during sign-out.
    }

    window.location.replace(Routes.AUTH);
  }, [logout]);
}
