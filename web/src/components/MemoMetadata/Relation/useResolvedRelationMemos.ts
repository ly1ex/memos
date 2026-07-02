import { useEffect, useMemo, useState } from "react";
import { memoApi } from "@/api/client";
import type { MemoRelation } from "@/api/types";
import { createMessage, MemoRelation_Memo, MemoRelation_MemoSchema } from "@/api/types";

export const useResolvedRelationMemos = (relations: MemoRelation[]) => {
  const [resolvedMemos, setResolvedMemos] = useState<Record<string, MemoRelation_Memo>>({});

  const missingMemoNames = useMemo(() => {
    const names = new Set<string>();

    for (const relation of relations) {
      for (const memo of [relation.memo, relation.relatedMemo]) {
        if (memo?.name && !memo.snippet && !resolvedMemos[memo.name]) {
          names.add(memo.name);
        }
      }
    }

    return [...names];
  }, [relations, resolvedMemos]);

  useEffect(() => {
    if (missingMemoNames.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const memos = await Promise.all(
          missingMemoNames.map(async (name) => {
            const memo = await memoApi.getMemo({ name });
            return createMessage(MemoRelation_MemoSchema, { name: memo.name, snippet: memo.snippet });
          }),
        );

        if (cancelled) {
          return;
        }

        setResolvedMemos((prev) => {
          const next = { ...prev };
          for (const memo of memos) {
            next[memo.name] = memo;
          }
          return next;
        });
      } catch {
        // Keep existing relation data when snippet hydration fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missingMemoNames]);

  return resolvedMemos;
};
