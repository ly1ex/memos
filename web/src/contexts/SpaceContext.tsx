import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type MemoEntryType, type MemoSpace, Visibility } from "@/api/types";

type PrivateEntryType = "MEMO" | "DIARY";

interface SpaceContextValue {
  space: MemoSpace;
  privateEntryType: PrivateEntryType;
  entryType: MemoEntryType;
  defaultVisibility: Visibility;
  isTransitioning: boolean;
  setSpace: (space: MemoSpace) => void;
  toggleSpace: () => void;
  setPrivateEntryType: (entryType: PrivateEntryType) => void;
}

const SpaceContext = createContext<SpaceContextValue | undefined>(undefined);

const SPACE_STORAGE_KEY = "lumina.space";
const PRIVATE_ENTRY_STORAGE_KEY = "lumina.private-entry-type";
const TRANSITION_MS = 520;

function readStoredSpace(): MemoSpace {
  if (typeof window === "undefined") {
    return "private";
  }
  return window.localStorage.getItem(SPACE_STORAGE_KEY) === "community" ? "community" : "private";
}

function readStoredPrivateEntryType(): PrivateEntryType {
  if (typeof window === "undefined") {
    return "MEMO";
  }
  return window.localStorage.getItem(PRIVATE_ENTRY_STORAGE_KEY) === "DIARY" ? "DIARY" : "MEMO";
}

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [space, setSpaceState] = useState<MemoSpace>(readStoredSpace);
  const [privateEntryType, setPrivateEntryTypeState] = useState<PrivateEntryType>(readStoredPrivateEntryType);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(SPACE_STORAGE_KEY, space);
  }, [space]);

  useEffect(() => {
    window.localStorage.setItem(PRIVATE_ENTRY_STORAGE_KEY, privateEntryType);
  }, [privateEntryType]);

  const setSpace = useCallback((nextSpace: MemoSpace) => {
    setSpaceState((currentSpace) => {
      if (currentSpace === nextSpace) {
        return currentSpace;
      }
      setIsTransitioning(true);
      window.setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
      return nextSpace;
    });
  }, []);

  const setPrivateEntryType = useCallback((nextEntryType: PrivateEntryType) => {
    setPrivateEntryTypeState(nextEntryType);
  }, []);

  const value = useMemo<SpaceContextValue>(() => {
    const entryType = space === "community" ? "COMMUNITY" : privateEntryType;
    return {
      space,
      privateEntryType,
      entryType,
      defaultVisibility: entryType === "COMMUNITY" ? Visibility.PUBLIC : Visibility.PRIVATE,
      isTransitioning,
      setSpace,
      toggleSpace: () => setSpace(space === "community" ? "private" : "community"),
      setPrivateEntryType,
    };
  }, [isTransitioning, privateEntryType, setPrivateEntryType, setSpace, space]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpace must be used within SpaceProvider");
  }
  return context;
}
