import { useEffect, useRef } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import SpaceLockToggle from "@/components/SpaceLockToggle";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpace } from "@/contexts/SpaceContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const MEMOS_DEPLOY_URL = "https://usememos.com/docs/deploy";

const DemoBanner = () => {
  const t = useTranslate();

  return (
    <div className="static w-full border-b border-border bg-muted/70 px-4 py-2 text-sm text-muted-foreground sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-2">
        <span className="font-medium text-foreground">{t("demo.banner-title")}</span>
        <span>{t("demo.banner-description")}</span>
        <a className="font-medium text-primary underline-offset-4 hover:underline" href={MEMOS_DEPLOY_URL} target="_blank" rel="noreferrer">
          {t("demo.deploy-link")}
        </a>
      </div>
    </div>
  );
};

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const { space, isTransitioning } = useSpace();
  const { pathname } = location;
  const prevPathnameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prevPathname = prevPathnameRef.current;

    // When the route changes and there is no filter in the search params, remove all filters.
    if (prevPathname !== undefined && prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, searchParams, removeFilter]);

  return (
    <div className={cn("lumina-app-shell", isTransitioning && "is-space-transitioning")} data-lumina-space={space}>
      <main className="lumina-main">
        {profile.demo && <DemoBanner />}
        <Outlet />
      </main>
      <SpaceLockToggle />
      <Navigation />
    </div>
  );
};

export default RootLayout;
