import type { Timestamp } from "@/api/time";

export { type Timestamp, timestampDate, timestampFromDate } from "@/api/time";

export type FieldMask = {
  paths: string[];
};

// biome-ignore lint/suspicious/noExplicitAny: compatibility factory for old DTO construction sites during the REST cutover.
export function createMessage<T = any>(_shape?: unknown, value?: unknown): T {
  return { ...defaultValueForShape(_shape), ...(isRecord(value) ? value : {}) } as T;
}

function defaultValueForShape(shape: unknown): Record<string, unknown> {
  switch (shape) {
    case UserSchema:
      return {
        name: "",
        role: User_Role.ROLE_UNSPECIFIED,
        username: "",
        email: "",
        displayName: "",
        avatarUrl: "",
        description: "",
        password: "",
        state: State.STATE_UNSPECIFIED,
      };
    case AttachmentSchema:
      return { name: "", filename: "", content: new Uint8Array(), externalLink: "", type: "", size: 0n };
    case MotionMediaSchema:
      return {
        family: MotionMediaFamily.MOTION_MEDIA_FAMILY_UNSPECIFIED,
        role: MotionMediaRole.MOTION_MEDIA_ROLE_UNSPECIFIED,
        groupId: "",
      };
    case ReactionSchema:
      return { name: "", creator: "", contentId: "", reactionType: "" };
    case MemoSchema:
      return {
        name: "",
        state: State.STATE_UNSPECIFIED,
        creator: "",
        content: "",
        visibility: Visibility.VISIBILITY_UNSPECIFIED,
        entryType: "MEMO",
        tags: [],
        pinned: false,
        attachments: [],
        relations: [],
        reactions: [],
        snippet: "",
      };
    case Memo_PropertySchema:
      return { hasLink: false, hasTaskList: false, hasCode: false, hasIncompleteTasks: false, title: "" };
    case MemoRelationSchema:
      return { type: MemoRelation_Type.TYPE_UNSPECIFIED };
    case MemoRelation_MemoSchema:
      return { name: "", snippet: "" };
    case MemoShareSchema:
      return { name: "" };
    case ShortcutSchema:
      return { name: "", title: "", filter: "" };
    case LinkMetadataSchema:
      return { url: "", title: "", description: "", image: "" };
    case UserStatsSchema:
      return { name: "", tagCount: {}, memoCreatedTimestamps: [], memoUpdatedTimestamps: [], pinnedMemos: [], totalMemoCount: 0 };
    case UserSetting_GeneralSettingSchema:
      return { locale: "", memoVisibility: "", theme: "" };
    case UserSetting_TagMetadataSchema:
      return { blurContent: false };
    case UserSetting_TagsSettingSchema:
      return { tags: {} };
    case UserSettingSchema:
    case InstanceSettingSchema:
      return { name: "", value: { case: undefined } };
    case InstanceProfileSchema:
      return { version: "", demo: false, instanceUrl: "", commit: "", needsSetup: false };
    case InstanceSetting_GeneralSettingSchema:
      return {
        disallowUserRegistration: false,
        disallowPasswordAuth: false,
        additionalScript: "",
        additionalStyle: "",
        weekStartDayOffset: 0,
        disallowChangeUsername: false,
        disallowChangeNickname: false,
      };
    case InstanceSetting_GeneralSetting_CustomProfileSchema:
      return { title: "", description: "", logoUrl: "" };
    case InstanceSetting_MemoRelatedSettingSchema:
      return { contentLengthLimit: 0, enableDoubleClickEdit: false, reactions: [] };
    case InstanceSetting_NotificationSettingSchema:
      return {};
    case InstanceSetting_NotificationSetting_EmailSettingSchema:
      return { enabled: false, fromEmail: "", fromName: "", replyTo: "" };
    case LocationSchema:
      return { placeholder: "", latitude: 0, longitude: 0 };
    case FieldMaskSchema:
      return { paths: [] };
    default:
      return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export enum State {
  STATE_UNSPECIFIED = 0,
  NORMAL = 1,
  ARCHIVED = 2,
}

export enum Visibility {
  VISIBILITY_UNSPECIFIED = 0,
  PRIVATE = 1,
  PROTECTED = 2,
  PUBLIC = 3,
}

export enum User_Role {
  ROLE_UNSPECIFIED = 0,
  ADMIN = 2,
  USER = 3,
}

export enum UserSetting_Key {
  KEY_UNSPECIFIED = 0,
  GENERAL = 1,
  WEBHOOKS = 4,
  TAGS = 5,
}

export enum InstanceSetting_Key {
  KEY_UNSPECIFIED = 0,
  GENERAL = 1,
  MEMO_RELATED = 3,
  TAGS = 4,
  NOTIFICATION = 5,
}

export enum MemoRelation_Type {
  TYPE_UNSPECIFIED = 0,
  REFERENCE = 1,
  COMMENT = 2,
}

export type MemoEntryType = "MEMO" | "DIARY" | "COMMUNITY";

export type MemoSpace = "private" | "community";

export enum MotionMediaFamily {
  MOTION_MEDIA_FAMILY_UNSPECIFIED = 0,
  APPLE_LIVE_PHOTO = 1,
  ANDROID_MOTION_PHOTO = 2,
}

export enum MotionMediaRole {
  MOTION_MEDIA_ROLE_UNSPECIFIED = 0,
  STILL = 1,
  VIDEO = 2,
  CONTAINER = 3,
}

export enum UserNotification_Status {
  STATUS_UNSPECIFIED = 0,
  UNREAD = 1,
  ARCHIVED = 2,
}

export enum UserNotification_Type {
  TYPE_UNSPECIFIED = 0,
  MEMO_COMMENT = 1,
  MEMO_MENTION = 2,
}

export type Color = {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: { value?: number };
};

export type Location = {
  placeholder: string;
  latitude: number;
  longitude: number;
};

export type MotionMedia = {
  family: MotionMediaFamily;
  role: MotionMediaRole;
  groupId: string;
  pairedAttachment?: string;
  presentationTimestampUs?: bigint;
  hasEmbeddedVideo?: boolean;
};

export type Attachment = {
  name: string;
  createTime?: Timestamp;
  filename: string;
  content?: Uint8Array;
  externalLink: string;
  type: string;
  size: bigint;
  memo?: string;
  motionMedia?: MotionMedia;
  id?: number;
  uid?: string;
  downloadUrl?: string;
};

export type Reaction = {
  name: string;
  creator: string;
  contentId: string;
  reactionType: string;
  createTime?: Timestamp;
};

export type Memo_Property = {
  hasLink: boolean;
  hasTaskList: boolean;
  hasCode: boolean;
  hasIncompleteTasks: boolean;
  title: string;
};

export type MemoRelation_Memo = {
  name: string;
  snippet: string;
};

export type MemoRelation = {
  memo?: MemoRelation_Memo;
  relatedMemo?: MemoRelation_Memo;
  type: MemoRelation_Type;
  relatedMemoId?: number;
};

export type Memo = {
  name: string;
  state: State;
  creator: string;
  createTime?: Timestamp;
  updateTime?: Timestamp;
  content: string;
  visibility: Visibility;
  entryType?: MemoEntryType;
  tags: string[];
  pinned: boolean;
  attachments: Attachment[];
  relations: MemoRelation[];
  reactions: Reaction[];
  property?: Memo_Property;
  parent?: string;
  snippet: string;
  location?: Location;
  id?: number;
  uid?: string;
};

export type MemoShare = {
  name: string;
  createTime?: Timestamp;
  expireTime?: Timestamp;
};

export type LinkMetadata = {
  url: string;
  title: string;
  description: string;
  image: string;
};

export type Shortcut = {
  name: string;
  title: string;
  filter: string;
};

export type User = {
  clerkUserId?: string;
  name: string;
  role: User_Role;
  username: string;
  displayUsername?: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  description: string;
  password?: string;
  state: State;
  createTime?: Timestamp;
  updateTime?: Timestamp;
};

export type UserStats = {
  name: string;
  memoTypeStats?: {
    linkCount: number;
    codeCount: number;
    todoCount: number;
    undoCount: number;
  };
  tagCount: Record<string, number>;
  memoCreatedTimestamps?: Timestamp[];
  memoUpdatedTimestamps?: Timestamp[];
  pinnedMemos?: string[];
  totalMemoCount: number;
};

export type UserSetting_GeneralSetting = {
  locale: string;
  memoVisibility: string;
  theme: string;
};

export type UserSetting_TagMetadata = {
  backgroundColor?: Color;
  blurContent: boolean;
};

export type UserSetting_TagsSetting = {
  tags: Record<string, UserSetting_TagMetadata>;
};

export type UserSetting_WebhooksSetting = {
  webhooks: UserWebhook[];
};

export type UserSetting = {
  name: string;
  value:
    | { case: "generalSetting"; value: UserSetting_GeneralSetting }
    | { case: "webhooksSetting"; value: UserSetting_WebhooksSetting }
    | { case: "tagsSetting"; value: UserSetting_TagsSetting }
    | { case: undefined; value?: undefined };
};

export type InstanceProfile = {
  version: string;
  demo: boolean;
  instanceUrl: string;
  admin?: User;
  commit: string;
  needsSetup: boolean;
};

export type InstanceSetting_GeneralSetting_CustomProfile = {
  title: string;
  description: string;
  logoUrl: string;
};

export type InstanceSetting_GeneralSetting = {
  disallowUserRegistration: boolean;
  disallowPasswordAuth: boolean;
  additionalScript: string;
  additionalStyle: string;
  customProfile?: InstanceSetting_GeneralSetting_CustomProfile;
  weekStartDayOffset: number;
  disallowChangeUsername: boolean;
  disallowChangeNickname: boolean;
};

export type InstanceSetting_MemoRelatedSetting = {
  contentLengthLimit: number;
  enableDoubleClickEdit: boolean;
  reactions: string[];
};

export type InstanceSetting_TagMetadata = {
  backgroundColor?: Color;
  blurContent: boolean;
};

export type InstanceSetting_TagsSetting = {
  tags: Record<string, InstanceSetting_TagMetadata>;
};

export type InstanceSetting_NotificationSetting_EmailSetting = {
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  useTls?: boolean;
  useSsl?: boolean;
};

export type InstanceSetting_NotificationSetting = {
  email?: InstanceSetting_NotificationSetting_EmailSetting;
};

export type InstanceSetting = {
  name: string;
  value:
    | { case: "generalSetting"; value: InstanceSetting_GeneralSetting }
    | { case: "memoRelatedSetting"; value: InstanceSetting_MemoRelatedSetting }
    | { case: "tagsSetting"; value: InstanceSetting_TagsSetting }
    | { case: "notificationSetting"; value: InstanceSetting_NotificationSetting }
    | { case: undefined; value?: undefined };
};

export type UserWebhook = {
  name: string;
  url: string;
  displayName: string;
  createTime?: Timestamp;
  updateTime?: Timestamp;
  signingSecret?: string;
  signingSecretSet: boolean;
};

export type UserNotification = {
  name: string;
  sender: string;
  senderUser?: User;
  status: UserNotification_Status;
  createTime?: Timestamp;
  type: UserNotification_Type;
  payload?:
    | { case: "memoComment"; value: { memo: string; relatedMemo: string; memoSnippet: string; relatedMemoSnippet: string } }
    | { case: "memoMention"; value: { memo: string; relatedMemo: string; memoSnippet: string; relatedMemoSnippet: string } }
    | { case: undefined; value?: undefined };
};

export type ListMemosRequest = {
  pageSize?: number;
  pageToken?: string;
  state?: State;
  filter?: string;
  orderBy?: string;
  showDeleted?: boolean;
  space?: MemoSpace;
  entryType?: MemoEntryType;
};

export type ListMemosResponse = {
  memos: Memo[];
  nextPageToken: string;
};

export type ListAttachmentsRequest = {
  pageSize?: number;
  pageToken?: string;
  filter?: string;
  orderBy?: string;
};

export type ListAllUserStatsRequest = {
  state?: State;
  filter?: string;
};

const shape = (name: string) => name;

export const AttachmentSchema = shape("Attachment");
export const BatchDeleteAttachmentsRequestSchema = shape("BatchDeleteAttachmentsRequest");
export const ColorSchema = shape("Color");
export const CreateMemoShareRequestSchema = shape("CreateMemoShareRequest");
export const DeleteMemoShareRequestSchema = shape("DeleteMemoShareRequest");
export const FieldMaskSchema = shape("FieldMask");
export const GetMemoByShareRequestSchema = shape("GetMemoByShareRequest");
export const InstanceProfileSchema = shape("InstanceProfile");
export const InstanceSettingSchema = shape("InstanceSetting");
export const InstanceSetting_GeneralSettingSchema = shape("InstanceSetting_GeneralSetting");
export const InstanceSetting_GeneralSetting_CustomProfileSchema = shape("InstanceSetting_GeneralSetting_CustomProfile");
export const InstanceSetting_MemoRelatedSettingSchema = shape("InstanceSetting_MemoRelatedSetting");
export const InstanceSetting_NotificationSettingSchema = shape("InstanceSetting_NotificationSetting");
export const InstanceSetting_NotificationSetting_EmailSettingSchema = shape("InstanceSetting_NotificationSetting_EmailSetting");
export const LinkMetadataSchema = shape("LinkMetadata");
export const ListAllUserStatsRequestSchema = shape("ListAllUserStatsRequest");
export const ListAttachmentsRequestSchema = shape("ListAttachmentsRequest");
export const ListMemoCommentsRequestSchema = shape("ListMemoCommentsRequest");
export const ListMemoSharesRequestSchema = shape("ListMemoSharesRequest");
export const ListMemosRequestSchema = shape("ListMemosRequest");
export const LocationSchema = shape("Location");
export const MemoRelationSchema = shape("MemoRelation");
export const MemoRelation_MemoSchema = shape("MemoRelation_Memo");
export const MemoSchema = shape("Memo");
export const MemoShareSchema = shape("MemoShare");
export const Memo_PropertySchema = shape("Memo_Property");
export const MotionMediaSchema = shape("MotionMedia");
export const ReactionSchema = shape("Reaction");
export const ShortcutSchema = shape("Shortcut");
export const TestInstanceEmailSettingRequestSchema = shape("TestInstanceEmailSettingRequest");
export const UserSchema = shape("User");
export const UserSettingSchema = shape("UserSetting");
export const UserSetting_GeneralSettingSchema = shape("UserSetting_GeneralSetting");
export const UserSetting_TagMetadataSchema = shape("UserSetting_TagMetadata");
export const UserSetting_TagsSettingSchema = shape("UserSetting_TagsSetting");
export const UserStatsSchema = shape("UserStats");
