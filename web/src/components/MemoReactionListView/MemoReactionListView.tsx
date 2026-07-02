import { memo } from "react";
import type { Memo, Reaction } from "@/api/types";
import { State } from "@/api/types";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useReactionGroups } from "./hooks";
import ReactionSelector from "./ReactionSelector";
import ReactionView from "./ReactionView";

interface Props {
  memo: Memo;
  reactions: Reaction[];
}

const MemoReactionListView = (props: Props) => {
  const { memo: memoData, reactions } = props;
  const currentUser = useCurrentUser();
  const reactionGroup = useReactionGroups(reactions);
  const readonly = memoData.state === State.ARCHIVED;

  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-row justify-start items-start flex-wrap gap-1 select-none">
      {Array.from(reactionGroup).map(([reactionType, users]) => (
        <ReactionView key={`${reactionType.toString()} ${users.length}`} memo={memoData} reactionType={reactionType} users={users} />
      ))}
      {!readonly && currentUser && <ReactionSelector memo={memoData} />}
    </div>
  );
};

export default memo(MemoReactionListView);
