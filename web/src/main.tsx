import "@github/relative-time-element";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import "./index.css";
import { refreshAccessToken } from "@/api/client";
import { ClerkAuthProvider, useFrontendAuthState } from "@/clerk-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LiquidGlassFilters } from "@/components/LiquidGlass";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { InstanceProvider, useInstance } from "@/contexts/InstanceContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { ViewProvider } from "@/contexts/ViewContext";
import { useLiveMemoRefresh } from "@/hooks/useLiveMemoRefresh";
import { useTokenRefreshOnFocus } from "@/hooks/useTokenRefreshOnFocus";
import { queryClient } from "@/lib/query-client";
import router from "./router";
import { applyLocaleEarly } from "./utils/i18n";
import { applyThemeEarly } from "./utils/theme";

// Apply theme and locale early to prevent flash
applyThemeEarly();
applyLocaleEarly();

// Inner component that initializes contexts
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { ready: frontendAuthReady, sessionKey: frontendAuthSessionKey } = useFrontendAuthState();
  const { isInitialized: authInitialized, initialize: initAuth, currentUser } = useAuth();
  const { isInitialized: instanceInitialized, initialize: initInstance } = useInstance();
  const instanceInitStartedRef = useRef(false);
  const authInitSessionKeyRef = useRef<string | null>(null);
  const isClerkCallbackPath = window.location.pathname === "/auth/sso-callback" || window.location.pathname === "/auth/signup/sso-callback";

  // Initialize public instance metadata once Clerk has settled enough to avoid
  // racing app boot with Clerk's own callback bootstrap.
  useEffect(() => {
    if (!frontendAuthReady) return;
    if (instanceInitStartedRef.current) return;
    instanceInitStartedRef.current = true;

    initInstance();
  }, [frontendAuthReady, initInstance]);

  // Reinitialize app auth whenever Clerk transitions between signed-out and
  // signed-in sessions. During Clerk's routed callback page, let the Clerk
  // component render and consume the callback before calling the Worker.
  useEffect(() => {
    if (!frontendAuthReady) return;
    if (isClerkCallbackPath && !frontendAuthSessionKey.startsWith("signed-in:")) return;
    if (authInitSessionKeyRef.current === frontendAuthSessionKey) return;
    authInitSessionKeyRef.current = frontendAuthSessionKey;

    initAuth();
  }, [frontendAuthReady, frontendAuthSessionKey, initAuth, isClerkCallbackPath]);

  // Proactively refresh token on window focus to prevent 401 errors
  // Only enabled when user is authenticated
  // Related: https://github.com/usememos/memos/issues/5589
  useTokenRefreshOnFocus(refreshAccessToken, !!currentUser);

  // Live refresh: Worker edition uses polling instead of SSE.
  useLiveMemoRefresh();

  if (!instanceInitialized || (!authInitialized && !isClerkCallbackPath)) {
    return null;
  }

  return <>{children}</>;
}

function Main() {
  return (
    <ClerkAuthProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <InstanceProvider>
            <AuthProvider>
              <ViewProvider>
                <NewMemoProvider>
                  <AppInitializer>
                    <LiquidGlassFilters />
                    <RouterProvider router={router} />
                    <Toaster position="top-right" />
                  </AppInitializer>
                </NewMemoProvider>
              </ViewProvider>
            </AuthProvider>
          </InstanceProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ErrorBoundary>
    </ClerkAuthProvider>
  );
}

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(<Main />);
