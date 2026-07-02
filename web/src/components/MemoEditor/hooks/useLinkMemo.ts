import { useEffect, useMemo, useState } from "react";
import { memoApi } from "@/api/client";
import { createMessage, type Memo, type MemoRelation, MemoRelation_MemoSchema, MemoRelation_Type, MemoRelationSchema } from "@/api/types";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { buildMemoCreatorFilter } from "@/helpers/resource-names";
import { useDebouncedEffect } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";

interface UseLinkMemoParams {
  isOpen: boolean;
  currentMemoName?: string;
  existingRelations: MemoRelation[];
  onAddRelation: (relation: MemoRelation) => void;
}

export const useLinkMemo = ({ isOpen, currentMemoName, existingRelations, onAddRelation }: UseLinkMemoParams) => {
  const user = useCurrentUser();
  const [searchText, setSearchText] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);

  const filteredMemos = fetchedMemos.filter((memo) => memo.name !== currentMemoName);

  const linkedMemoNames = useMemo(() => new Set(existingRelations.map((r) => r.relatedMemo?.name)), [existingRelations]);

  const isAlreadyLinked = (memoName: string): boolean => linkedMemoNames.has(memoName);

  useEffect(() => {
    if (isOpen) {
      setSearchText("");
    }
  }, [isOpen]);

  useDebouncedEffect(
    async () => {
      if (!isOpen) return;

      setIsFetching(true);
      try {
        const conditions: string[] = [];
        const creatorFilter = buildMemoCreatorFilter(user?.name ?? "");
        if (creatorFilter) {
          conditions.push(creatorFilter);
        }
        if (searchText) {
          conditions.push(`content.contains("${searchText}")`);
        }
        const { memos } = await memoApi.listMemos({
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
          filter: conditions.join(" && "),
        });
        setFetchedMemos(memos);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetching(false);
      }
    },
    300,
    [isOpen, searchText],
  );

  const addMemoRelation = (memo: Memo) => {
    const relation = createMessage(MemoRelationSchema, {
      type: MemoRelation_Type.REFERENCE,
      relatedMemo: createMessage(MemoRelation_MemoSchema, {
        name: memo.name,
        snippet: memo.snippet,
      }),
    });
    onAddRelation(relation);
  };

  return {
    searchText,
    setSearchText,
    isFetching,
    filteredMemos,
    addMemoRelation,
    isAlreadyLinked,
  };
};
