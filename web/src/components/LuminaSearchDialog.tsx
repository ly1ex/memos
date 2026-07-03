import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const contentSearchFilters = (query: string): MemoFilter[] =>
  query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => ({ factor: "contentSearch", value }));

const LuminaSearchDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const navigateTo = useNavigateTo();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { filters, setFilters, removeFiltersByFactor } = useMemoFilterContext();
  const existingSearchText = useMemo(
    () =>
      filters
        .filter((filter) => filter.factor === "contentSearch")
        .map((filter) => filter.value)
        .join(" "),
    [filters],
  );
  const [query, setQuery] = useState(existingSearchText);

  useEffect(() => {
    if (!open) return;
    setQuery(existingSearchText);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [existingSearchText, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextSearchFilters = contentSearchFilters(query);
    const nonSearchFilters = filters.filter((filter) => filter.factor !== "contentSearch");

    if (nextSearchFilters.length === 0) {
      removeFiltersByFactor("contentSearch");
    } else {
      setFilters([...nonSearchFilters, ...nextSearchFilters]);
    }

    onOpenChange(false);

    const targetPath = currentUser ? Routes.HOME : Routes.EXPLORE;
    if (location.pathname !== targetPath) {
      navigateTo(targetPath);
    }
  };

  const handleClear = () => {
    setQuery("");
    removeFiltersByFactor("contentSearch");
    inputRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lumina-search-dialog" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{t("common.search")}</DialogTitle>
        </DialogHeader>
        <form className="lumina-search-form" onSubmit={handleSubmit}>
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("memo.search-placeholder")}
            className="lumina-search-input"
          />
          {query && (
            <Button type="button" variant="ghost" size="icon" className="lumina-search-clear" onClick={handleClear}>
              <XIcon className="size-4" />
              <span className="sr-only">{t("common.clear")}</span>
            </Button>
          )}
          <Button type="submit" className={cn("lumina-search-submit", !query.trim() && "opacity-70")}>
            {t("common.search")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LuminaSearchDialog;
