import { Navigate } from "react-router-dom";
import { Memo, State, Visibility } from "@/api/types";
import DiaryModeSwitch from "@/components/DiaryModeSwitch";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useSpace } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { compactMode } = useView();
  const { space } = useSpace();

  if (currentUser && space === "private") {
    return <Navigate to="/" replace />;
  }

  // Determine visibility filter based on authentication status
  // - Logged-in users: Can see PUBLIC and PROTECTED memos
  // - Visitors: Can only see PUBLIC memos
  // Note: The backend is responsible for filtering stats based on visibility permissions.
  const visibilities = currentUser ? [Visibility.PUBLIC, Visibility.PROTECTED] : [Visibility.PUBLIC];

  // Build filter using unified hook (no creator scoping for Explore)
  const memoFilter = useMemoFilters({
    includeShortcuts: false,
    includePinned: false,
    visibilities,
  });

  // Get sorting logic using unified hook (no pinned sorting)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: false,
    state: State.NORMAL,
  });

  return (
    <section className="lumina-page lumina-discover-page">
      <div className="lumina-page-hero">
        <h1>{t("lumina.discover-title")}</h1>
        <p>{t("lumina.discover-description")}</p>
        <DiaryModeSwitch className="mt-7" size="sm" variant="latest-curated" />
      </div>

      <PagedMemoList
        renderer={(memo: Memo) => (
          <MemoView
            key={`${memo.name}-${memo.updateTime}`}
            className="lumina-discover-card"
            memo={memo}
            showCreator
            showVisibility
            showEngagement
            compact={compactMode}
          />
        )}
        className="lumina-discover-feed"
        listClassName="lumina-discover-stack"
        filtersClassName="lumina-filters"
        listSort={listSort}
        orderBy={orderBy}
        filter={memoFilter}
        space="community"
        entryType="COMMUNITY"
        showCreator
      />
    </section>
  );
};

export default Explore;
