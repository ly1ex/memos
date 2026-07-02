import { Memo, State } from "@/api/types";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";

const Archived = () => {
  const user = useCurrentUser();
  const { compactMode } = useView();

  // Build filter using unified hook (no shortcuts or pinned filter)
  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: false,
  });

  // Get sorting logic using unified hook (pinned first, archived state)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.ARCHIVED,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact={compactMode} />}
      listSort={listSort}
      state={State.ARCHIVED}
      orderBy={orderBy}
      filter={memoFilter}
    />
  );
};

export default Archived;
