import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface DiaryModeSwitchProps {
  className?: string;
  size?: "sm" | "md";
  variant?: "memo-diary" | "latest-curated";
}

const DiaryModeSwitch = ({ className, size = "md", variant = "memo-diary" }: DiaryModeSwitchProps) => {
  const t = useTranslate();
  const options =
    variant === "latest-curated"
      ? [
          { key: "latest", label: t("lumina.latest"), active: true, disabled: false },
          { key: "curated", label: t("lumina.curated"), active: false, disabled: true },
        ]
      : [
          { key: "memos", label: t("common.memos"), active: true, disabled: false },
          { key: "diary", label: t("lumina.diary"), active: false, disabled: true },
        ];

  return (
    <div
      className={cn("lumina-segment", size === "sm" ? "h-9 min-w-40 text-xs" : "h-11 min-w-56 text-sm", className)}
      role="tablist"
      aria-label={variant === "latest-curated" ? t("lumina.feed-mode") : t("lumina.entry-mode")}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={option.active}
          disabled={option.disabled}
          title={option.disabled ? t("lumina.diary-coming-soon") : undefined}
          className={cn("lumina-segment-item", option.active && "is-active")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DiaryModeSwitch;
