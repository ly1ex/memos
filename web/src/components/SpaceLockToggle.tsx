import { LockKeyholeIcon, LockKeyholeOpenIcon } from "lucide-react";
import { useSpace } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const SpaceLockToggle = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const navigateTo = useNavigateTo();
  const { space, toggleSpace } = useSpace();
  const isPrivate = space === "private";
  const Icon = isPrivate ? LockKeyholeIcon : LockKeyholeOpenIcon;
  const label = isPrivate ? t("lumina.space-private") : t("lumina.space-community");

  const handleClick = () => {
    if (!currentUser && isPrivate) {
      navigateTo(Routes.AUTH);
      return;
    }
    toggleSpace();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn("lumina-space-lock", isPrivate ? "is-private" : "is-community")}
            onClick={handleClick}
            aria-pressed={isPrivate}
            aria-label={label}
          >
            <span className="lumina-space-lock-ring">
              <Icon className="size-5" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SpaceLockToggle;
