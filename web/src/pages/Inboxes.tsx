import { sortBy } from "lodash-es";
import { ArchiveIcon, BellIcon, InboxIcon } from "lucide-react";
import { useState } from "react";
import { timestampDate, UserNotification, UserNotification_Status, UserNotification_Type } from "@/api/types";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import MemoMentionMessage from "@/components/Inbox/MemoMentionMessage";
import Placeholder from "@/components/Placeholder";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useUserQueries";
import { useTranslate } from "@/utils/i18n";

const Inboxes = () => {
  const t = useTranslate();
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");

  // Fetch notifications with React Query
  const { data: fetchedNotifications = [] } = useNotifications();

  const allNotifications = sortBy(fetchedNotifications, (notification: UserNotification) => {
    return -((notification.createTime ? timestampDate(notification.createTime) : undefined)?.getTime() || 0);
  });

  const notifications = allNotifications.filter((notification) => {
    if (filter === "unread") return notification.status === UserNotification_Status.UNREAD;
    if (filter === "archived") return notification.status === UserNotification_Status.ARCHIVED;
    return true;
  });

  const unreadCount = allNotifications.filter((n) => n.status === UserNotification_Status.UNREAD).length;
  const archivedCount = allNotifications.filter((n) => n.status === UserNotification_Status.ARCHIVED).length;

  return (
    <section className="lumina-page lumina-alerts-page">
      <div className="lumina-page-hero">
        <h1>{t("lumina.alerts")}</h1>
        <p>{t("lumina.alerts-description")}</p>
      </div>

      <div className="lumina-alerts-panel">
        <div className="flex w-full flex-col gap-4 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BellIcon className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">{t("lumina.alerts")}</h2>
            {unreadCount > 0 && <span className="lumina-count-pill">{unreadCount}</span>}
          </div>

          <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} variant="segmented">
            <TabsList className="lumina-compact-tabs">
              <TabsTrigger value="all">
                {t("common.all")} ({allNotifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread">
                <InboxIcon className="size-3.5" />
                {t("inbox.unread")} ({unreadCount})
              </TabsTrigger>
              <TabsTrigger value="archived">
                <ArchiveIcon className="size-3.5" />
                {t("common.archived")} ({archivedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="w-full">
          {notifications.length === 0 ? (
            <Placeholder
              variant="empty"
              message={filter === "unread" ? t("inbox.no-unread") : filter === "archived" ? t("inbox.no-archived") : t("message.no-data")}
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {notifications.map((notification: UserNotification) => {
                if (notification.type === UserNotification_Type.MEMO_COMMENT) {
                  return <MemoCommentMessage key={notification.name} notification={notification} />;
                }
                if (notification.type === UserNotification_Type.MEMO_MENTION) {
                  return <MemoMentionMessage key={notification.name} notification={notification} />;
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Inboxes;
