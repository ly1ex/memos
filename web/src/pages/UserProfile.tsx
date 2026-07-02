import copy from "copy-to-clipboard";
import { ExternalLinkIcon, LayoutListIcon, MapIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "react-hot-toast";
import { useParams, useSearchParams } from "react-router-dom";
import { Memo, State, type Timestamp, timestampDate } from "@/api/types";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { useUser, useUserStats } from "@/hooks/useUserQueries";
import { useTranslate } from "@/utils/i18n";

type TabView = "memos" | "map";

const UserMemoMap = lazy(() => import("@/components/UserMemoMap"));

interface User {
  name: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  description?: string;
}

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

const ProfileHeader = ({
  user,
  totalMemoCount,
  dayStreak,
  onCopyProfileLink,
  shareLabel,
  roleLabel,
  totalEntriesLabel,
  dayStreakLabel,
  statisticsLabel,
}: {
  user: User;
  totalMemoCount: number;
  dayStreak: number;
  onCopyProfileLink: () => void;
  shareLabel: string;
  roleLabel: string;
  totalEntriesLabel: string;
  dayStreakLabel: string;
  statisticsLabel: string;
}) => (
  <div className="lumina-profile-card">
    <div className="flex flex-col items-center text-center">
      <UserAvatar className="size-24 rounded-full border border-border/70 shadow-sm" avatarUrl={user.avatarUrl} />
      <h1 className="mt-5 text-3xl font-semibold text-foreground">{user.displayName || user.username}</h1>
      <p className="mt-1 font-mono text-sm uppercase text-muted-foreground">{roleLabel}</p>
      {user.description && <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{user.description}</p>}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopyProfileLink}
        className="mt-5 rounded-full border border-border/70 bg-background/80 px-4"
      >
        <ExternalLinkIcon className="size-4" />
        {shareLabel}
      </Button>
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

const UserProfile = () => {
  const t = useTranslate();
  const username = useParams().username;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("view") === "map" ? "map" : "memos") as TabView;
  const { compactMode } = useView();

  const { data: user, isLoading, error } = useUser(`users/${username}`, { enabled: !!username });
  const { data: userStats } = useUserStats(user?.name);

  if (error && !isLoading) {
    toast.error(t("message.user-not-found"));
  }

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  const handleCopyProfileLink = () => {
    if (!user) return;
    copy(`${window.location.origin}/u/${encodeURIComponent(user.username)}`);
    toast.success(t("message.copied"));
  };

  const toggleTab = (view: TabView) => {
    setSearchParams((prev) => {
      view === "map" ? prev.set("view", "map") : prev.delete("view");
      return prev;
    });
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
            onCopyProfileLink={handleCopyProfileLink}
            shareLabel={t("common.share")}
            roleLabel={t("lumina.sanctuary-keeper")}
            totalEntriesLabel={t("lumina.total-entries")}
            dayStreakLabel={t("lumina.day-streak")}
            statisticsLabel={t("lumina.profile-statistics")}
          />

          <div className="lumina-profile-content">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="lumina-section-title">{t("lumina.recent-reflections")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("lumina.recent-reflections-description")}</p>
              </div>
              <Tabs value={activeTab} onValueChange={(value) => toggleTab(value as TabView)} variant="segmented">
                <TabsList className="lumina-compact-tabs">
                  <TabsTrigger value="memos">
                    <LayoutListIcon className="size-4" />
                    {t("common.memos")}
                  </TabsTrigger>
                  <TabsTrigger value="map">
                    <MapIcon className="size-4" />
                    {t("common.map")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {activeTab === "memos" ? (
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
              />
            ) : (
              <Suspense fallback={<div className="h-[60dvh] rounded-md border border-border bg-muted/30 sm:h-[500px]" />}>
                <UserMemoMap creator={user.name} className="h-[60dvh] rounded-md sm:h-[500px]" />
              </Suspense>
            )}
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
