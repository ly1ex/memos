import type { Memo } from "@/api/types";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showEngagement?: boolean;
  className?: string;
  parentPage?: string;
  disableDetailNavigation?: boolean;
  shareImageDialogOpen?: boolean;
  onShareImageDialogOpenChange?: (open: boolean) => void;
}

export interface MemoHeaderProps {
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
}

export interface MemoBodyProps {
  compact?: boolean;
  showReactions?: boolean;
}
