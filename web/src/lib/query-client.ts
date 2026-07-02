import { QueryClient } from "@tanstack/react-query";
import { ApiError, ApiErrorCode } from "@/api/errors";

// Don't retry requests that failed due to authentication errors. Clerk owns session
// refresh; when the REST client reports Unauthenticated, another React Query retry
// would only repeat the same redirect-worthy request.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && error.code === ApiErrorCode.Unauthenticated) return false;
  return failureCount < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Balanced approach: Fresh enough for collaboration, but reduces unnecessary refetches
      // Individual queries can override with shorter staleTime if needed (e.g., notifications)
      staleTime: 1000 * 30, // 30 seconds (increased from 10s for better performance)
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: shouldRetry,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: shouldRetry,
    },
  },
});
