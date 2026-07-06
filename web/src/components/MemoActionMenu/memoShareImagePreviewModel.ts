import type { Memo, User } from "@/api/types";
import { timestampDate } from "@/api/types";
import { separateAttachments } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { type AttachmentVisualItem, buildAttachmentVisualItems, countLogicalAttachmentItems } from "@/utils/media-item";
import { getMemoSharePreviewAvatarUrl } from "./memoShareImage";

interface BuildMemoShareImagePreviewModelOptions {
  memo: Memo;
  creator?: User;
  fallbackDisplayName: string;
  locale: string;
}

export interface MemoShareImageAttachmentSummaryBadge {
  type: "attachment-summary";
  count: number;
}

export type MemoShareImageFooterBadge = MemoShareImageAttachmentSummaryBadge;

export interface MemoShareImagePreviewModel {
  displayName: string;
  avatarUrl?: string;
  formattedDisplayTime?: string;
  visualItems: AttachmentVisualItem[];
  footerBadges: MemoShareImageFooterBadge[];
}

export const buildMemoShareImagePreviewModel = ({
  memo,
  creator,
  fallbackDisplayName,
  locale,
}: BuildMemoShareImagePreviewModelOptions): MemoShareImagePreviewModel => {
  const displayName = creator?.displayName || creator?.displayUsername || creator?.username || fallbackDisplayName;
  const avatarUrl = getMemoSharePreviewAvatarUrl(creator?.avatarUrl);
  const displayTime = memo.createTime ? timestampDate(memo.createTime) : undefined;
  const formattedDisplayTime = displayTime?.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const attachmentGroups = separateAttachments(memo.attachments);
  const visualItems = buildAttachmentVisualItems(attachmentGroups.visual);
  const attachmentCount = countLogicalAttachmentItems(memo.attachments);
  const nonVisualAttachmentCount = Math.max(attachmentCount - visualItems.length, 0);
  const footerBadges: MemoShareImageFooterBadge[] =
    nonVisualAttachmentCount > 0 ? [{ type: "attachment-summary", count: attachmentCount }] : [];

  return {
    displayName,
    avatarUrl,
    formattedDisplayTime,
    visualItems,
    footerBadges,
  };
};
