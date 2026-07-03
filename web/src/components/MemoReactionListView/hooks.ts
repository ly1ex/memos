import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { memoApi } from "@/api/client";
import type { Memo, Reaction, User } from "@/api/types";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { useUsersByNames } from "@/hooks/useUserQueries";

export type ReactionGroup = Map<string, User[]>;

function patchMemoReactions(memo: Memo, memoName: string, reactions: Reaction[]): Memo {
  return memo.name === memoName ? { ...memo, reactions } : memo;
}

function patchMemoReactionsInData(data: unknown, memoName: string, reactions: Reaction[]): unknown {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((entry) => (isMemoLike(entry) ? patchMemoReactions(entry, memoName, reactions) : entry));
  }

  if (typeof data !== "object") {
    return data;
  }

  const record = data as Record<string, unknown>;
  if (Array.isArray(record.memos)) {
    return {
      ...record,
      memos: record.memos.map((entry) => (isMemoLike(entry) ? patchMemoReactions(entry, memoName, reactions) : entry)),
    };
  }

  if (Array.isArray(record.pages)) {
    return {
      ...record,
      pages: record.pages.map((page) => patchMemoReactionsInData(page, memoName, reactions)),
    };
  }

  if (isMemoLike(record)) {
    return patchMemoReactions(record, memoName, reactions);
  }

  return data;
}

function isMemoLike(value: unknown): value is Memo {
  return typeof value === "object" && value !== null && typeof (value as { name?: unknown }).name === "string";
}

export const useReactionGroups = (reactions: Reaction[]): ReactionGroup => {
  const currentUser = useCurrentUser();
  const creatorNames = useMemo(() => reactions.map((r) => r.creator), [reactions]);
  const { data: userMap } = useUsersByNames(creatorNames);

  return useMemo(() => {
    const reactionGroup = new Map<string, User[]>();
    for (const reaction of reactions) {
      const user = userMap?.get(reaction.creator) ?? (reaction.creator === currentUser?.name ? currentUser : undefined);
      if (!user) continue;

      const users = reactionGroup.get(reaction.reactionType) || [];
      users.push(user);
      reactionGroup.set(reaction.reactionType, users);
    }
    return reactionGroup;
  }, [currentUser, reactions, userMap]);
};

interface UseReactionActionsOptions {
  memo: Memo;
  onComplete?: () => void;
}

export const useReactionActions = ({ memo, onComplete }: UseReactionActionsOptions) => {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const hasReacted = (reactionType: string) => {
    return memo.reactions.some((r) => r.reactionType === reactionType && r.creator === currentUser?.name);
  };

  const handleReactionClick = async (reactionType: string) => {
    if (!currentUser) return;

    const previousReactions = memo.reactions;
    const nextReactions = hasReacted(reactionType)
      ? memo.reactions.filter((reaction) => !(reaction.reactionType === reactionType && reaction.creator === currentUser.name))
      : [
          ...memo.reactions,
          {
            name: `${memo.name}/reactions/${encodeURIComponent(reactionType)}`,
            creator: currentUser.name,
            contentId: memo.name,
            reactionType,
          },
        ];

    queryClient.setQueriesData({ queryKey: memoKeys.all }, (data) => patchMemoReactionsInData(data, memo.name, nextReactions));

    try {
      if (hasReacted(reactionType)) {
        const reactions = memo.reactions.filter(
          (reaction) => reaction.reactionType === reactionType && reaction.creator === currentUser.name,
        );
        await Promise.all(reactions.map((reaction) => memoApi.deleteMemoReaction({ name: reaction.name })));
      } else {
        await memoApi.upsertMemoReaction({
          name: memo.name,
          reaction: { contentId: memo.name, reactionType },
        });
      }
      // Refetch the memo to get updated reactions and invalidate cache
      const updatedMemo = await memoApi.getMemo({ name: memo.name });
      queryClient.setQueryData(memoKeys.detail(memo.name), updatedMemo);
      queryClient.setQueriesData({ queryKey: memoKeys.all }, (data) => patchMemoReactionsInData(data, memo.name, updatedMemo.reactions));
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // If this memo is a comment, refresh the parent's comments list so the comment's reactions update in the UI
      if (memo.parent) {
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(memo.parent) });
      }
    } catch {
      queryClient.setQueriesData({ queryKey: memoKeys.all }, (data) => patchMemoReactionsInData(data, memo.name, previousReactions));
    }
    onComplete?.();
  };

  return { hasReacted, handleReactionClick };
};

export const formatReactionTooltip = (users: User[], reactionType: string): string => {
  if (users.length === 0) return "";
  const formatUserName = (user: User) => user.displayName || user.username;
  if (users.length < 5) {
    return `${users.map(formatUserName).join(", ")} reacted with ${reactionType.toLowerCase()}`;
  }
  return `${users.slice(0, 4).map(formatUserName).join(", ")} and ${users.length - 4} more reacted with ${reactionType.toLowerCase()}`;
};
