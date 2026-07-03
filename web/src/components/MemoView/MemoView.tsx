import { HeartIcon, MessageCircleIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { State, Visibility } from "@/api/types";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUser } from "@/hooks/useUserQueries";
import { findTagMetadata } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { isSuperUser } from "@/utils/user";
import MemoShareImageDialog from "../MemoActionMenu/MemoShareImageDialog";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoCommentListView, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const { memo: memoData, className, parentPage: parentPageProp, compact, showCreator, showVisibility, showPinned } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);

  const currentUser = useCurrentUser();
  const { userTagsSetting } = useAuth();
  const creator = useUser(memoData.creator).data;
  const navigateTo = useNavigateTo();
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = memoData.creator !== currentUser?.name && !isSuperUser(currentUser);
  const parentPage = parentPageProp || "/";

  // Blur content when any tag has blur_content enabled in the current user's tag settings.
  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = memoData.tags?.some((tag) => userTagsSetting && findTagMetadata(tag, userTagsSetting)?.blurContent) ?? false;
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const openEditor = useCallback(() => setShowEditor(true), []);
  const closeEditor = useCallback(() => setShowEditor(false), []);

  const location = useLocation();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memoData.name}`) || location.pathname.startsWith("/memos/shares/");
  const canOpenDetail = !props.disableDetailNavigation && !isInMemoDetailPage;
  const commentAmount = computeCommentAmount(memoData);
  const showCommentPreview = !isInMemoDetailPage && commentAmount > 0;

  const openMemoDetail = useCallback(() => {
    navigateTo(`/${memoData.name}`, { state: { from: parentPage } });
  }, [memoData.name, navigateTo, parentPage]);

  const shouldIgnoreDetailNavigation = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return true;
    }
    if (window.getSelection()?.toString()) {
      return true;
    }
    return Boolean(
      target.closest(
        [
          "a",
          "button",
          "input",
          "textarea",
          "select",
          "summary",
          "img",
          "video",
          "audio",
          "[contenteditable='true']",
          "[role='button']",
          "[role='menuitem']",
          "[data-no-detail-navigation]",
        ].join(","),
      ),
    );
  }, []);

  const handleArticleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!canOpenDetail || shouldIgnoreDetailNavigation(event.target)) {
        return;
      }
      openMemoDetail();
    },
    [canOpenDetail, openMemoDetail, shouldIgnoreDetailNavigation],
  );

  const handleArticleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!canOpenDetail || shouldIgnoreDetailNavigation(event.target)) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        openMemoDetail();
      }
    },
    [canOpenDetail, openMemoDetail, shouldIgnoreDetailNavigation],
  );

  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const updateWidth = (nextWidth?: number) => {
      const width = Math.round(nextWidth ?? card.getBoundingClientRect().width);
      setCardWidth((prev) => (prev === width ? prev : width));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width);
    });

    resizeObserver.observe(card);
    return () => resizeObserver.disconnect();
  }, []);

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      toggleBlurVisibility,
      openPreview,
    }),
    [
      memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      toggleBlurVisibility,
      openPreview,
    ],
  );

  if (showEditor) {
    const canChangeMemoVisibility = !memoData.parent && (memoData.entryType ?? "MEMO") === "MEMO";
    return (
      <MemoEditor
        autoFocus
        className="mb-2"
        cacheKey={`inline-memo-editor-${memoData.name}`}
        memo={memoData}
        entryType={memoData.entryType ?? "MEMO"}
        defaultVisibility={memoData.visibility}
        visibilityOptions={[Visibility.PRIVATE, Visibility.PUBLIC]}
        showVisibilitySelector={canChangeMemoVisibility}
        parentMemoName={memoData.parent || undefined}
        onConfirm={closeEditor}
        onCancel={closeEditor}
      />
    );
  }

  const engagementBar = props.showEngagement && !isInMemoDetailPage && (
    <div className="memo-engagement-bar" data-no-detail-navigation>
      <button type="button" className="memo-engagement-button" onClick={openMemoDetail}>
        <HeartIcon className="size-4" />
        <span>{memoData.reactions.length}</span>
      </button>
      <button
        type="button"
        className="memo-engagement-button"
        onClick={() => navigateTo(`/${memoData.name}#comments`, { state: { from: parentPage } })}
      >
        <MessageCircleIcon className="size-4" />
        <span>{commentAmount}</span>
      </button>
    </div>
  );

  const article = (
    <article
      className={cn(
        MEMO_CARD_BASE_CLASSES,
        showCommentPreview ? "mb-0 rounded-b-none" : "mb-2",
        canOpenDetail && "cursor-pointer",
        className,
      )}
      ref={cardRef}
      tabIndex={canOpenDetail ? 0 : readonly ? -1 : 0}
      role={canOpenDetail ? "link" : undefined}
      onClick={handleArticleClick}
      onKeyDown={handleArticleKeyDown}
    >
      <MemoHeader showCreator={showCreator} showVisibility={showVisibility} showPinned={showPinned} />

      <MemoBody compact={compact} showReactions={!props.showEngagement} />
      {engagementBar}

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={setPreviewOpen}
        items={previewState.items}
        initialIndex={previewState.index}
      />

      {props.onShareImageDialogOpenChange && (
        <MemoShareImageDialog open={Boolean(props.shareImageDialogOpen)} onOpenChange={props.onShareImageDialogOpenChange} />
      )}
    </article>
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      {showCommentPreview ? (
        <div className="w-full mb-2">
          {article}
          <MemoCommentListView />
        </div>
      ) : (
        article
      )}
    </MemoViewContext.Provider>
  );
};

export default memo(MemoView);
