import { useUser as useClerkUser } from "@clerk/react";
import { useEffect, useMemo } from "react";
import { User_Role } from "@/api/types";
import { isClerkEnabled } from "@/clerk-auth";
import { SETTINGS_SECTIONS, type SettingSectionDefinition } from "@/components/Settings/settingSections";
import UserAvatar from "@/components/UserAvatar";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";

const GITHUB_COMMIT_URL_PREFIX = "https://github.com/usememos/memos/commit/";

const isCommitSha = (commit: string) => /^[0-9a-f]{7,40}$/i.test(commit);

const ClerkSettingAvatar = ({ fallbackAvatarUrl }: { fallbackAvatarUrl?: string }) => {
  const { user } = useClerkUser();

  return <UserAvatar className="size-16 rounded-full border border-border/70 shadow-sm" avatarUrl={user?.imageUrl || fallbackAvatarUrl} />;
};

const SettingAvatar = ({ avatarUrl }: { avatarUrl?: string }) => {
  if (isClerkEnabled) {
    return <ClerkSettingAvatar fallbackAvatarUrl={avatarUrl} />;
  }

  return <UserAvatar className="size-16 rounded-full border border-border/70 shadow-sm" avatarUrl={avatarUrl} />;
};

const SettingPanel = ({ section }: { section: SettingSectionDefinition }) => {
  const t = useTranslate();
  const SectionComponent = section.component;
  const Icon = section.icon;

  return (
    <section id={section.key} className="lumina-settings-expanded-panel setting-surface">
      <div className="lumina-settings-expanded-header">
        <span className="lumina-settings-expanded-icon">
          <Icon className="size-4" />
        </span>
        <h2>{t(section.labelKey)}</h2>
      </div>
      <div className="lumina-settings-expanded-body">
        <SectionComponent />
      </div>
    </section>
  );
};

const Setting = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { profile, fetchSettings } = useInstance();
  const isHost = user?.role === User_Role.ADMIN;
  const commitUrl = isCommitSha(profile.commit) ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";

  const sectionGroups = useMemo(() => {
    const visibleSections = SETTINGS_SECTIONS.filter((section) => section.scope === "basic" || isHost);
    return {
      basic: visibleSections.filter((section) => section.scope === "basic"),
      admin: visibleSections.filter((section) => section.scope === "admin"),
    };
  }, [isHost]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    const preloadSettingKeys = new Set(sectionGroups.admin.flatMap((section) => section.preloadSettingKeys ?? []));
    void fetchSettings([...preloadSettingKeys]);
  }, [fetchSettings, isHost, sectionGroups.admin]);

  return (
    <section className="lumina-page lumina-settings-page">
      <div className="lumina-settings-identity setting-surface">
        <SettingAvatar avatarUrl={user?.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate text-xl font-medium text-foreground">{user?.displayName || user?.username}</p>
          <p className="truncate font-mono text-sm text-muted-foreground">@{user?.username}</p>
        </div>
        <span className="lumina-role-pill ml-auto shrink-0">{isHost ? t("common.admin") : t("lumina.member")}</span>
      </div>

      <div className="lumina-settings-expanded-stack">
        {sectionGroups.basic.map((section) => (
          <SettingPanel key={section.key} section={section} />
        ))}

        {sectionGroups.admin.length > 0 && (
          <div className="lumina-settings-expanded-group">
            <span className="lumina-section-kicker">{t("common.admin")}</span>
            {sectionGroups.admin.map((section) => (
              <SettingPanel key={section.key} section={section} />
            ))}
          </div>
        )}

        {isHost && (
          <div className="lumina-settings-version setting-surface">
            <span>{t("setting.version")}</span>
            <strong>{profile.version}</strong>
            {profile.commit && (
              <span className="break-all font-mono text-xs text-muted-foreground">
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
        )}
      </div>
    </section>
  );
};

export default Setting;
