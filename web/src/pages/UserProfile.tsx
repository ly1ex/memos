import { useClerk, useUser as useClerkUser } from "@clerk/react";
import copy from "copy-to-clipboard";
import { ExternalLinkIcon, LogOutIcon, UserCogIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import { type User as ApiUser, type Memo, State, type Timestamp, timestampDate } from "@/api/types";
import { clerkAppearance, isClerkEnabled } from "@/clerk-auth";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useSpace } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSignOut } from "@/hooks/useSignOut";
import { useUser, useUserStats } from "@/hooks/useUserQueries";
import { useTranslate } from "@/utils/i18n";

const toDayKey = (date: Date) => [date.getFullYear(), date.getMonth(), date.getDate()].join("-");

const computeDayStreak = (timestamps?: Timestamp[]) => {
  if (!timestamps?.length) return 0;

  const days = new Set(
    timestamps
      .map((timestamp) => timestampDate(timestamp))
      .filter((date): date is Date => Boolean(date))
      .map(toDayKey),
  );

  const cursor = new Date();
  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const ClerkProfileAvatar = ({ fallbackAvatarUrl }: { fallbackAvatarUrl?: string }) => {
  const clerk = useClerk();
  const { user } = useClerkUser();

  return (
    <button
      type="button"
      className="lumina-profile-avatar-button"
      onClick={() => clerk.openUserProfile({ appearance: clerkAppearance })}
      aria-label="Open account settings"
    >
      <UserAvatar className="size-24 rounded-full border border-border/70 shadow-sm" avatarUrl={user?.imageUrl || fallbackAvatarUrl} />
    </button>
  );
};

const ProfileAvatar = ({ user, isOwnProfile }: { user: ApiUser; isOwnProfile: boolean }) => {
  if (isOwnProfile && isClerkEnabled) {
    return <ClerkProfileAvatar fallbackAvatarUrl={user.avatarUrl} />;
  }

  return <UserAvatar className="size-24 rounded-full border border-border/70 shadow-sm" avatarUrl={user.avatarUrl} />;
};

const ProfileHeader = ({
  user,
  totalMemoCount,
  dayStreak,
  isOwnProfile,
  onCopyProfileLink,
  onSignOut,
  shareLabel,
  roleLabel,
  totalEntriesLabel,
  dayStreakLabel,
  statisticsLabel,
  accountLabel,
  signOutLabel,
}: {
  user: ApiUser;
  totalMemoCount: number;
  dayStreak: number;
  isOwnProfile: boolean;
  onCopyProfileLink: () => void;
  onSignOut: () => void;
  shareLabel: string;
  roleLabel: string;
  totalEntriesLabel: string;
  dayStreakLabel: string;
  statisticsLabel: string;
  accountLabel: string;
  signOutLabel: string;
}) => (
  <div className="lumina-profile-card">
    <div className="flex flex-col items-center text-center">
      <ProfileAvatar user={user} isOwnProfile={isOwnProfile} />
      <h1 className="mt-5 text-3xl font-semibold text-foreground">{user.displayName || user.username}</h1>
      <p className="mt-1 font-mono text-sm uppercase text-muted-foreground">{roleLabel}</p>
      {user.description && <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{user.description}</p>}
      <div className="lumina-profile-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopyProfileLink}
          className="rounded-full border border-border/70 bg-background/80 px-4"
        >
          <ExternalLinkIcon className="size-4" />
          {shareLabel}
        </Button>
        {isOwnProfile && isClerkEnabled && <ClerkAccountButton label={accountLabel} />}
        {isOwnProfile && (
          <Button variant="ghost" size="sm" onClick={onSignOut} className="rounded-full border border-border/70 bg-background/80 px-4">
            <LogOutIcon className="size-4" />
            {signOutLabel}
          </Button>
        )}
      </div>
    </div>

    <div className="lumina-profile-stats" aria-label={statisticsLabel}>
      <div>
        <strong>{totalMemoCount}</strong>
        <span>{totalEntriesLabel}</span>
      </div>
      <div className="lumina-profile-stat-divider" />
      <div>
        <strong>{dayStreak}</strong>
        <span>{dayStreakLabel}</span>
      </div>
    </div>
  </div>
);

const ClerkAccountButton = ({ label }: { label: string }) => {
  const clerk = useClerk();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => clerk.openUserProfile({ appearance: clerkAppearance })}
      className="rounded-full border border-border/70 bg-background/80 px-4"
    >
      <UserCogIcon className="size-4" />
      {label}
    </Button>
  );
};

const UserProfile = () => {
  const t = useTranslate();
  const username = useParams().username;
  const currentUser = useCurrentUser();
  const signOut = useSignOut();
  const { compactMode } = useView();
  const { space } = useSpace();

  const { data: user, isLoading, error } = useUser(`users/${username}`, { enabled: !!username });
  const { data: userStats } = useUserStats(user?.name);
  const isOwnProfile = Boolean(user && currentUser && user.name === currentUser.name);
  const profileSpace = isOwnProfile ? space : "community";

  if (error && !isLoading) {
    toast.error(t("message.user-not-found"));
  }

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: profileSpace === "private",
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: profileSpace === "private",
    state: State.NORMAL,
  });

  const handleCopyProfileLink = () => {
    if (!user) return;
    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  if (isLoading) return null;

  return (
    <section className="lumina-page lumina-profile-page">
      {user ? (
        <>
          <ProfileHeader
            user={user}
            totalMemoCount={userStats?.totalMemoCount ?? 0}
            dayStreak={computeDayStreak(userStats?.memoCreatedTimestamps)}
            isOwnProfile={isOwnProfile}
            onCopyProfileLink={handleCopyProfileLink}
            onSignOut={signOut}
            shareLabel={t("common.share")}
            roleLabel={t("lumina.sanctuary-keeper")}
            totalEntriesLabel={t("lumina.total-entries")}
            dayStreakLabel={t("lumina.day-streak")}
            statisticsLabel={t("lumina.profile-statistics")}
            accountLabel={t("common.account")}
            signOutLabel={t("common.sign-out")}
          />

          <div className="lumina-profile-content">
            <div>
              <h2 className="lumina-section-title">{t("lumina.recent-reflections")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("lumina.recent-reflections-description")}</p>
            </div>

            <PagedMemoList
              renderer={(memo: Memo) => (
                <MemoView
                  key={`${memo.name}-${memo.updateTime}`}
                  className="lumina-profile-memo"
                  memo={memo}
                  showVisibility
                  showPinned
                  compact={compactMode}
                />
              )}
              className="lumina-profile-feed"
              listClassName="lumina-profile-grid"
              filtersClassName="lumina-filters"
              listSort={listSort}
              orderBy={orderBy}
              filter={memoFilter}
              space={profileSpace}
              entryType={profileSpace === "community" ? "COMMUNITY" : undefined}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">{t("message.user-not-found")}</p>
        </div>
      )}
    </section>
  );
};

export default UserProfile;
