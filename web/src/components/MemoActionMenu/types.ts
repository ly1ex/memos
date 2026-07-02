import type { Memo } from "@/api/types";

export interface MemoActionMenuProps {
  memo: Memo;
  readonly?: boolean;
  className?: string;
  onEdit?: () => void;
}
