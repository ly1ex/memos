import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { User_Role } from "@/api/types";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import {
  DEFAULT_SETTING_SECTION,
  isSettingSectionKey,
  SETTINGS_SECTIONS,
  type SettingSectionDefinition,
  type SettingSectionKey,
} from "@/components/Settings/settingSections";
import UserAvatar from "@/components/UserAvatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useTranslate } from "@/utils/i18n";

const GITHUB_COMMIT_URL_PREFIX = "https://github.com/usememos/memos/commit/";

const isCommitSha = (commit: string) => /^[0-9a-f]{7,40}$/i.test(commit);

const Setting = () => {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
  const location = useLocation();
  const user = useCurrentUser();
  const { profile, fetchSettings } = useInstance();
  const [selectedSection, setSelectedSection] = useState<SettingSectionKey>(DEFAULT_SETTING_SECTION);
  const isHost = user?.role === User_Role.ADMIN;
  const commitUrl = isCommitSha(profile.commit) ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";

  const sectionGroups = useMemo(() => {
    const visibleSections = SETTINGS_SECTIONS.filter((section) => section.scope === "basic" || isHost);
    return {
      basic: visibleSections.filter((section) => section.scope === "basic"),
      admin: visibleSections.filter((section) => section.scope === "admin"),
      all: visibleSections,
    };
  }, [isHost]);

  const visibleSectionKeys = useMemo(() => new Set(sectionGroups.all.map((section) => section.key)), [sectionGroups.all]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) {
      setSelectedSection(DEFAULT_SETTING_SECTION);
      return;
    }
    if (isSettingSectionKey(hash) && visibleSectionKeys.has(hash)) {
      setSelectedSection(hash);
    }
  }, [location.hash, visibleSectionKeys]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    const preloadSettingKeys = new Set(sectionGroups.admin.flatMap((section) => section.preloadSettingKeys ?? []));
    void fetchSettings([...preloadSettingKeys]);
  }, [fetchSettings, isHost, sectionGroups.admin]);

  const handleSectionSelectorItemClick = (section: SettingSectionKey) => {
    window.location.hash = section;
  };

  const selectedSectionDefinition =
    sectionGroups.all.find((section) => section.key === selectedSection) ??
    SETTINGS_SECTIONS.find((section) => section.key === DEFAULT_SETTING_SECTION) ??
    SETTINGS_SECTIONS[0];
  const ActiveSection = selectedSectionDefinition.component;

  const renderSectionMenuItems = (sections: SettingSectionDefinition[]) =>
    sections.map((section) => (
      <SectionMenuItem
        key={section.key}
        text={t(section.labelKey)}
        icon={section.icon}
        isSelected={selectedSection === section.key}
        onClick={() => handleSectionSelectorItemClick(section.key)}
      />
    ));

  return (
    <section className="lumina-page lumina-sanctuary-page">
      <div className="lumina-sanctuary-card">
        <div className="lumina-sanctuary-heading">
          <h1>{t("lumina.sanctuary-title")}</h1>
          <p>{t("lumina.sanctuary-description")}</p>
        </div>

        <div className="lumina-sanctuary-section">
          <span className="lumina-section-kicker">{t("lumina.identity")}</span>
          <div className="lumina-identity-row">
            <UserAvatar className="size-16 rounded-full border border-border/70 shadow-sm" avatarUrl={user?.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-xl font-medium text-foreground">{user?.displayName || user?.username}</p>
              <p className="truncate font-mono text-sm text-muted-foreground">@{user?.username}</p>
            </div>
            <span className="lumina-role-pill ml-auto shrink-0">{isHost ? t("common.admin") : t("lumina.member")}</span>
          </div>
        </div>

        <div className="lumina-sanctuary-section">
          <span className="lumina-section-kicker">{t("lumina.data-boundary")}</span>
          <div className="lumina-settings-layout">
            {sm && (
              <aside className="lumina-settings-nav">
                <span className="lumina-settings-nav-title">{t("common.basic")}</span>
                <div className="flex w-full flex-col items-start gap-1">{renderSectionMenuItems(sectionGroups.basic)}</div>
                {isHost && (
                  <>
                    <span className="lumina-settings-nav-title mt-5">{t("common.admin")}</span>
                    <div className="flex w-full flex-col items-start gap-1">
                      {renderSectionMenuItems(sectionGroups.admin)}
                      <div className="mt-3 px-3 text-sm leading-5 text-muted-foreground/80">
                        {t("setting.version")}: {profile.version}
                        {profile.commit && (
                          <span className="block break-all font-mono">
                            Commit:{" "}
                            {commitUrl ? (
                              <a className="underline hover:text-foreground" href={commitUrl} target="_blank" rel="noreferrer">
                                {profile.commit}
                              </a>
                            ) : (
                              profile.commit
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </aside>
            )}
            <div className="min-w-0 grow overflow-x-auto">
              {!sm && (
                <div className="mb-5 inline-block w-full">
                  <Select value={selectedSection} onValueChange={(value) => handleSectionSelectorItemClick(value as SettingSectionKey)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("setting.select-section")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionGroups.all.map((section) => (
                        <SelectItem key={section.key} value={section.key}>
                          {t(section.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="lumina-settings-content">
                <ActiveSection />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Setting;
