import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Memo, State } from "@/api/types";
import DiaryModeSwitch from "@/components/DiaryModeSwitch";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useInstance } from "@/contexts/InstanceContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpace } from "@/contexts/SpaceContext";
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
  const { space, privateEntryType, entryType, defaultVisibility, setPrivateEntryType } = useSpace();
  const md = useMediaQuery("md");
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const isPrivateSpace = space === "private";

  const memoFilter = useMemoFilters({
    creatorName: isPrivateSpace ? user?.name : undefined,
    includeShortcuts: isPrivateSpace,
    includePinned: isPrivateSpace,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: isPrivateSpace,
    state: State.NORMAL,
  });
  const editorPlaceholder =
    space === "community"
      ? t("lumina.community-placeholder")
      : entryType === "DIARY"
        ? t("lumina.diary-placeholder")
        : t("editor.any-thoughts");

  return (
    <section className="lumina-page lumina-home-page" data-space={space}>
      {isPrivateSpace && (
        <div className="flex w-full justify-center md:hidden">
          <DiaryModeSwitch className="mb-8" value={privateEntryType} onChange={setPrivateEntryType} />
        </div>
      )}
      <NewMemoProvider>
        <PagedMemoList
          key={`${space}-${entryType}`}
          renderer={(memo: Memo) => (
            <MemoView
              key={`${memo.name}-${memo.updateTime}`}
              className="lumina-feed-memo"
              memo={memo}
              showCreator
              showVisibility
              showPinned
              showEngagement
              compact={compactMode}
            />
          )}
          className="lumina-home-feed"
          editorClassName="lumina-editor"
          editorHeader={
            isPrivateSpace ? <DiaryModeSwitch className="mx-auto mb-6" value={privateEntryType} onChange={setPrivateEntryType} /> : null
          }
          editorCacheKey={`home-${space}-${entryType.toLowerCase()}-editor`}
          editorPlaceholder={editorPlaceholder}
          editorDefaultVisibility={defaultVisibility}
          editorShowVisibilitySelector={false}
          listClassName="lumina-memo-stack"
          filtersClassName="lumina-filters"
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          space={space}
          entryType={entryType}
          enabled={isInitialized}
          showMemoEditor={md || mobileComposerOpen}
          showCreator
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
