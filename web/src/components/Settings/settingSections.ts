import { CogIcon, LibraryIcon, type LucideIcon, MailIcon, Settings2Icon, TagsIcon, UsersIcon, WebhookIcon } from "lucide-react";
import { type ComponentType } from "react";
import { InstanceSetting_Key } from "@/api/types";
import InstanceSection from "@/components/Settings/InstanceSection";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import NotificationSection from "@/components/Settings/NotificationSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import TagsSection from "@/components/Settings/TagsSection";
import WebhookSection from "@/components/Settings/WebhookSection";

export type SettingSectionKey = "preference" | "webhook" | "member" | "system" | "memo" | "notification" | "tags";

type SettingSectionScope = "basic" | "admin";

export interface SettingSectionDefinition {
  key: SettingSectionKey;
  scope: SettingSectionScope;
  labelKey: `setting.${SettingSectionKey}.label`;
  icon: LucideIcon;
  component: ComponentType;
  preloadSettingKeys?: InstanceSetting_Key[];
}

export const SETTINGS_SECTIONS: SettingSectionDefinition[] = [
  {
    key: "preference",
    scope: "basic",
    labelKey: "setting.preference.label",
    icon: CogIcon,
    component: PreferencesSection,
  },
  {
    key: "webhook",
    scope: "basic",
    labelKey: "setting.webhook.label",
    icon: WebhookIcon,
    component: WebhookSection,
  },
  {
    key: "member",
    scope: "admin",
    labelKey: "setting.member.label",
    icon: UsersIcon,
    component: MemberSection,
  },
  {
    key: "system",
    scope: "admin",
    labelKey: "setting.system.label",
    icon: Settings2Icon,
    component: InstanceSection,
  },
  {
    key: "memo",
    scope: "admin",
    labelKey: "setting.memo.label",
    icon: LibraryIcon,
    component: MemoRelatedSettings,
  },
  {
    key: "tags",
    scope: "basic",
    labelKey: "setting.tags.label",
    icon: TagsIcon,
    component: TagsSection,
  },
  {
    key: "notification",
    scope: "admin",
    labelKey: "setting.notification.label",
    icon: MailIcon,
    component: NotificationSection,
    preloadSettingKeys: [InstanceSetting_Key.NOTIFICATION],
  },
];

export const DEFAULT_SETTING_SECTION: SettingSectionKey = "preference";

export const isSettingSectionKey = (value: string): value is SettingSectionKey => {
  return SETTINGS_SECTIONS.some((section) => section.key === value);
};
