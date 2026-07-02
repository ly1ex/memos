import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Memo, State } from "@/api/types";
import DiaryModeSwitch from "@/components/DiaryModeSwitch";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useInstance } from "@/contexts/InstanceContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { isInitialized } = useInstance();
  const { compactMode } = useView();
  const md = useMediaQuery("md");
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <section className="lumina-page lumina-home-page">
      <div className="flex w-full justify-center md:hidden">
        <DiaryModeSwitch className="mb-8" />
      </div>
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo) => (
            <MemoView
              key={`${memo.name}-${memo.updateTime}`}
              className="lumina-feed-memo"
              memo={memo}
              showVisibility
              showPinned
              compact={compactMode}
            />
          )}
          className="lumina-home-feed"
          editorClassName="lumina-editor"
          editorHeader={<DiaryModeSwitch className="mx-auto mb-6" />}
          listClassName="lumina-memo-stack"
          filtersClassName="lumina-filters"
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          enabled={isInitialized}
          showMemoEditor={md || mobileComposerOpen}
        />
      </NewMemoProvider>
      {!md && !mobileComposerOpen && (
        <button
          type="button"
          className="lumina-mobile-compose-fab"
          onClick={() => {
            setMobileComposerOpen(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={t("common.create")}
        >
          <PlusIcon className="size-6" />
        </button>
      )}
    </section>
  );
};

export default Home;
