import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";

const POLL_INTERVAL_MS = 30_000;

export type SSEConnectionStatus = "connected" | "disconnected" | "connecting";

type Listener = () => void;

let status: SSEConnectionStatus = "disconnected";
const listeners = new Set<Listener>();

function getPollingStatus(): SSEConnectionStatus {
  return status;
}

function setPollingStatus(nextStatus: SSEConnectionStatus) {
  if (status !== nextStatus) {
    status = nextStatus;
    listeners.forEach((listener) => listener());
  }
}

function subscribePollingStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Kept for existing UI imports. Cloudflare Worker edition does not expose SSE;
 * this status now reflects whether memo polling is active.
 */
export function useSSEConnectionStatus(): SSEConnectionStatus {
  return useSyncExternalStore(subscribePollingStatus, getPollingStatus, getPollingStatus);
}

export function useLiveMemoRefresh() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const currentUserName = currentUser?.name;

  useEffect(() => {
    if (!currentUserName) {
      setPollingStatus("disconnected");
      return;
    }

    setPollingStatus("connected");
    const invalidateActiveMemoQueries = () => {
      queryClient.invalidateQueries({ queryKey: memoKeys.all, refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: userKeys.stats(), refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: userKeys.notifications(), refetchType: "active" });
    };

    const interval = window.setInterval(invalidateActiveMemoQueries, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      setPollingStatus("disconnected");
    };
  }, [currentUserName, queryClient]);
}
