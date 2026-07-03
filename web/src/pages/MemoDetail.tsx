import {
  ArrowUpLeftFromCircleIcon,
  CalendarClockIcon,
  CheckCircleIcon,
  Code2Icon,
  HashIcon,
  ImageIcon,
  LinkIcon,
  type LucideIcon,
  MessageCircleIcon,
  PaperclipIcon,
  Share2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ApiError, ApiErrorCode } from "@/api/errors";
import { type Attachment, type Memo, timestampDate } from "@/api/types";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoSharePanel from "@/components/MemoDetailSidebar/MemoSharePanel";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import VisibilityIcon from "@/components/VisibilityIcon";
import { memoNamePrefix } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useInfiniteMemoComments, useMemo } from "@/hooks/useMemoQueries";
import { useSharedMemo, withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import { isSuperUser } from "@/utils/user";

const MemoDetailActionPanel = ({
  canManageShares,
  commentCount,
  onShareImageOpen,
  onShareLinksOpen,
}: {
  canManageShares: boolean;
  commentCount: number;
  onShareImageOpen: () => void;
  onShareLinksOpen: () => void;
}) => {
  const t = useTranslate();

  const scrollToComments = () => {
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lumina-detail-actions" data-no-detail-navigation>
      <Button type="button" variant="ghost" className="lumina-detail-action-button" onClick={onShareImageOpen}>
        <ImageIcon className="size-4" />
        <span>{t("memo.share.image-share")}</span>
      </Button>
      {canManageShares && (
        <Button type="button" variant="ghost" className="lumina-detail-action-button" onClick={onShareLinksOpen}>
          <Share2Icon className="size-4" />
          <span>{t("memo.share.link-share")}</span>
        </Button>
      )}
      <Button type="button" variant="ghost" className="lumina-detail-action-button" onClick={scrollToComments}>
        <MessageCircleIcon className="size-4" />
        <span>
          {t("memo.comment.self")}
          {commentCount > 0 ? ` ${commentCount}` : ""}
        </span>
      </Button>
    </div>
  );
};

const formatMemoTime = (memoTime: Memo["createTime"]) => {
  if (!memoTime) return "—";
  return timestampDate(memoTime).toLocaleString();
};

const MemoDetailInfoPanel = ({ memo, commentCount }: { memo: Memo; commentCount: number }) => {
  const t = useTranslate();
  const property = memo.property;
  const visibilityLabel = t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as Parameters<typeof t>[0]);
  const hasUpdated =
    memo.createTime && memo.updateTime && timestampDate(memo.createTime).getTime() !== timestampDate(memo.updateTime).getTime();
  const propertyBadges = [
    property?.hasLink ? { icon: LinkIcon, label: t("memo.links") } : undefined,
    property?.hasTaskList ? { icon: CheckCircleIcon, label: t("memo.to-do") } : undefined,
    property?.hasCode ? { icon: Code2Icon, label: t("memo.code") } : undefined,
  ].filter(Boolean) as { icon: LucideIcon; label: string }[];

  return (
    <div className="lumina-detail-info" data-no-detail-navigation>
      <div className="lumina-detail-info-grid">
        <div className="lumina-detail-info-item">
          <span>{t("common.created-at")}</span>
          <strong>
            <CalendarClockIcon className="size-4" />
            {formatMemoTime(memo.createTime)}
          </strong>
        </div>
        {hasUpdated && (
          <div className="lumina-detail-info-item">
            <span>{t("common.last-updated-at")}</span>
            <strong>{formatMemoTime(memo.updateTime)}</strong>
          </div>
        )}
        <div className="lumina-detail-info-item">
          <span>{t("common.visibility")}</span>
          <strong>
            <VisibilityIcon visibility={memo.visibility} />
            {visibilityLabel}
          </strong>
        </div>
        <div className="lumina-detail-info-item">
          <span>{t("common.attachments")}</span>
          <strong>
            <PaperclipIcon className="size-4" />
            {memo.attachments.length}
          </strong>
        </div>
        <div className="lumina-detail-info-item">
          <span>{t("memo.comment.self")}</span>
          <strong>
            <MessageCircleIcon className="size-4" />
            {commentCount}
          </strong>
        </div>
      </div>
      {(memo.tags.length > 0 || propertyBadges.length > 0) && (
        <div className="lumina-detail-token-groups">
          {memo.tags.length > 0 && (
            <div className="lumina-detail-token-group">
              <span className="lumina-section-kicker">{t("common.tags")}</span>
              <div className="flex flex-wrap gap-1.5">
                {memo.tags.map((tag) => (
                  <span key={tag} className="lumina-detail-token">
                    <HashIcon className="size-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {propertyBadges.length > 0 && (
            <div className="lumina-detail-token-group">
              <span className="lumina-section-kicker">{t("common.properties")}</span>
              <div className="flex flex-wrap gap-1.5">
                {propertyBadges.map(({ icon: Icon, label }) => (
                  <span key={label} className="lumina-detail-token">
                    <Icon className="size-3" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MemoDetail = () => {
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);
  const [shareLinkPanelOpen, setShareLinkPanelOpen] = useState(false);
  const currentUser = useCurrentUser();
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;

  // Detect share mode from the route parameter.
  const shareToken = params.token;
  const isShareMode = !!shareToken;

  // Primary memo fetch — share token or direct name.
  const memoNameFromParams = params.uid ? `${memoNamePrefix}${params.uid}` : "";
  const {
    data: memoFromDirect,
    error: directError,
    isLoading: directLoading,
  } = useMemo(memoNameFromParams, { enabled: !isShareMode && !!memoNameFromParams });
  const { data: memoFromShare, error: shareError, isLoading: shareLoading } = useSharedMemo(shareToken ?? "", { enabled: isShareMode });

  const memo = isShareMode ? memoFromShare : memoFromDirect;
  const error = isShareMode ? shareError : directError;
  const isLoading = isShareMode ? shareLoading : directLoading;
  const memoName = memo?.name ?? memoNameFromParams;

  useMemoDetailError({
    error: error as Error | null,
  });

  const { data: parentMemo } = useMemo(memo?.parent || "", {
    enabled: !!memo?.parent,
  });

  const {
    data: comments = [],
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useInfiniteMemoComments(memoName, {
    enabled: !!memo,
  });

  // Scroll to the hash target once it's in the DOM. The effect re-runs as the memo loads (footnote
  // anchors) and as comments arrive (comment anchors), since the target may render in either; the
  // ref guards against re-scrolling the same hash on every later comments page-load.
  const scrolledHashRef = useRef("");
  useEffect(() => {
    if (!hash || scrolledHashRef.current === hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    scrolledHashRef.current = hash;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, memo, comments]);

  if (isShareMode) {
    const isNotFound = error instanceof ApiError && (error.code === ApiErrorCode.NotFound || error.code === ApiErrorCode.Unauthenticated);
    if (isNotFound || (!isLoading && !memo)) {
      return <Navigate to="/404" replace />;
    }
  }

  if (isLoading || !memo) {
    return null;
  }

  // In share mode, rewrite attachment URLs to include the share token for unauthenticated access.
  const displayMemo = isShareMode
    ? { ...memo, attachments: withShareAttachmentLinks(memo.attachments as Attachment[], shareToken!) }
    : memo;
  const mentionResolutionContents = [displayMemo.content, ...comments.map((comment) => comment.content)];
  const canManageShares = Boolean(!displayMemo.parent && (displayMemo.creator === currentUser?.name || isSuperUser(currentUser)));
  const canShareLinks = canManageShares && displayMemo.entryType === "COMMUNITY";

  return (
    <section className="lumina-page lumina-detail-page">
      <MentionResolutionProvider contents={mentionResolutionContents}>
        <div className={cn("lumina-detail-shell")}>
          <div className="lumina-detail-main">
            {parentMemo && (
              <div className="w-auto inline-block mb-2">
                <Link
                  className="px-3 py-1 border border-border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-muted-foreground hover:shadow hover:opacity-80"
                  to={`/${parentMemo.name}`}
                  state={locationState}
                  viewTransition
                >
                  <ArrowUpLeftFromCircleIcon className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                  <span className="truncate">{parentMemo.content}</span>
                </Link>
              </div>
            )}
            <MemoView
              key={`${displayMemo.name}-${displayMemo.updateTime}`}
              className="lumina-detail-memo"
              memo={displayMemo}
              compact={false}
              parentPage={locationState?.from}
              shareImageDialogOpen={shareImageDialogOpen}
              showCreator
              showVisibility
              showPinned
              onShareImageDialogOpenChange={setShareImageDialogOpen}
            />
            <MemoDetailActionPanel
              canManageShares={canShareLinks}
              commentCount={comments.length}
              onShareImageOpen={() => setShareImageDialogOpen(true)}
              onShareLinksOpen={() => setShareLinkPanelOpen(true)}
            />
            <MemoDetailInfoPanel memo={displayMemo} commentCount={comments.length} />
            <MemoCommentSection
              memo={displayMemo}
              comments={comments}
              parentPage={locationState?.from}
              hasMoreComments={hasNextComments}
              isFetchingMoreComments={isFetchingNextComments}
              onLoadMoreComments={fetchNextComments}
            />
          </div>
        </div>
      </MentionResolutionProvider>
      {canShareLinks && (
        <MemoSharePanel memoName={displayMemo.name} open={shareLinkPanelOpen} onClose={() => setShareLinkPanelOpen(false)} />
      )}
    </section>
  );
};

export default MemoDetail;
