import { BellIcon, CompassIcon, HomeIcon, InfoIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { UserNotification_Status } from "@/api/types";
import { useSpace } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

interface Props {
  collapsed?: boolean;
  className?: string;
}

interface NavItem {
  id: string;
  path: string;
  title: string;
  icon: ReactNode;
  end?: boolean;
  active?: boolean;
  badge?: ReactNode;
  ariaLabel?: string;
}

const Navigation = ({ className }: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { space } = useSpace();
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter((n) => n.status === UserNotification_Status.UNREAD).length;
  const profilePath = currentUser ? `/u/${encodeURIComponent(currentUser.username)}` : Routes.AUTH;

  const authenticatedItems: NavItem[] = [
    {
      id: "navigation-home",
      path: Routes.HOME,
      title: t("common.home"),
      icon: <HomeIcon className="size-5" />,
      end: true,
    },
    ...(space === "community"
      ? [
          {
            id: "navigation-discover",
            path: Routes.EXPLORE,
            title: t("common.explore"),
            icon: <CompassIcon className="size-5" />,
          },
        ]
      : []),
    {
      id: "navigation-alerts",
      path: Routes.INBOX,
      title: t("lumina.alerts"),
      icon: <BellIcon className="size-5" />,
      badge: unreadCount > 0 ? <span className="lumina-nav-dot" /> : null,
      ariaLabel: unreadCount > 0 ? `${t("lumina.alerts")}, ${unreadCount} ${t("inbox.unread")}` : t("lumina.alerts"),
    },
    {
      id: "navigation-settings",
      path: Routes.SETTING,
      title: t("common.settings"),
      icon: <SettingsIcon className="size-5" />,
    },
    {
      id: "navigation-profile",
      path: profilePath,
      title: t("common.my"),
      icon: <UserRoundIcon className="size-5" />,
      active: location.pathname.startsWith("/u/"),
    },
  ];

  const guestItems: NavItem[] = [
    {
      id: "navigation-discover",
      path: Routes.EXPLORE,
      title: t("common.explore"),
      icon: <CompassIcon className="size-5" />,
    },
    {
      id: "navigation-about",
      path: Routes.ABOUT,
      title: t("common.about"),
      icon: <InfoIcon className="size-5" />,
    },
    {
      id: "navigation-sign-in",
      path: Routes.AUTH,
      title: t("common.sign-in"),
      icon: <UserRoundIcon className="size-5" />,
    },
  ];

  const items = currentUser ? authenticatedItems : guestItems;

  return (
    <nav className={cn("lumina-bottom-nav", className)} aria-label={t("lumina.primary-navigation")}>
      {items.map((item) => (
        <NavLink
          key={item.id}
          id={item.id}
          to={item.path}
          end={item.end}
          aria-label={item.ariaLabel}
          className={({ isActive }) => cn("lumina-bottom-nav-item", (item.active ?? isActive) && "is-active")}
          viewTransition
        >
          <span className="relative inline-flex">
            {item.icon}
            {item.badge}
          </span>
          <span className="lumina-bottom-nav-label">{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default Navigation;
