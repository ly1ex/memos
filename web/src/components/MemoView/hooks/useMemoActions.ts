import type { Memo } from "@/api/types";
import { useUpdateMemo } from "@/hooks/useMemoQueries";

export const useMemoActions = (memo: Memo) => {
  const { mutateAsync: updateMemo } = useUpdateMemo();

  const unpinMemo = async () => {
    if (!memo.pinned) return;
    await updateMemo({ update: { name: memo.name, pinned: false }, updateMask: ["pinned"] });
  };

  return { unpinMemo };
};
