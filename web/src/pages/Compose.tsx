import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import DiaryModeSwitch from "@/components/DiaryModeSwitch";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import { Button } from "@/components/ui/button";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpace } from "@/contexts/SpaceContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

const Compose = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { filters } = useMemoFilterContext();
  const { space, privateEntryType, entryType, defaultVisibility, setPrivateEntryType } = useSpace();
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);
  const isPrivateSpace = space === "private";
  const editorPlaceholder =
    space === "community"
      ? t("lumina.community-placeholder")
      : entryType === "DIARY"
        ? t("lumina.diary-placeholder")
        : t("editor.any-thoughts");
  const close = () => navigateTo(Routes.HOME);

  return (
    <section className="lumina-page lumina-compose-page">
      <div className="lumina-compose-shell">
        <div className="lumina-compose-header">
          <Button type="button" variant="ghost" size="icon" className="lumina-compose-back" onClick={close} aria-label={t("common.cancel")}>
            <ArrowLeftIcon className="size-5" />
          </Button>
          <h1>{t("common.create")}</h1>
          <span className="size-9" aria-hidden="true" />
        </div>

        <MemoEditor
          className="lumina-editor lumina-compose-editor lumina-liquid-glass"
          header={
            isPrivateSpace ? <DiaryModeSwitch className="mx-auto mb-6" value={privateEntryType} onChange={setPrivateEntryType} /> : null
          }
          cacheKey={`compose-${space}-${entryType.toLowerCase()}-editor`}
          placeholder={editorPlaceholder}
          defaultCreateTime={defaultCreateTime}
          entryType={entryType}
          defaultVisibility={defaultVisibility}
          showVisibilitySelector={false}
          autoFocus
          onConfirm={close}
          onCancel={close}
        />
      </div>
    </section>
  );
};

export default Compose;
