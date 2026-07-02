import { LockIcon, SearchIcon } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";
import UserMenu from "./UserMenu";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const LuminaTopBar = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const profilePath = currentUser ? `/u/${encodeURIComponent(currentUser.username)}` : Routes.AUTH;

  return (
    <header className="lumina-topbar">
      <div className="lumina-topbar-inner">
        <NavLink className="lumina-brand" to={currentUser ? Routes.HOME : Routes.EXPLORE} viewTransition>
          LUMINA
        </NavLink>

        <div className="flex items-center justify-end gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  className={cn("lumina-icon-button", !currentUser && "opacity-50")}
                  to={currentUser ? Routes.SHORTCUTS : Routes.EXPLORE}
                  aria-label={t("common.search")}
                >
                  <SearchIcon className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t("common.search")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link className="lumina-icon-button hidden sm:inline-flex" to={profilePath} aria-label={t("lumina.private-boundary")}>
                  <LockIcon className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t("lumina.private-boundary")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {currentUser ? (
            <div className="lumina-avatar-trigger">
              <UserMenu collapsed />
            </div>
          ) : (
            <Button asChild size="sm" className="rounded-full px-4">
              <Link to={Routes.AUTH}>{t("common.sign-in")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default LuminaTopBar;
