import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface DiaryModeSwitchProps {
  className?: string;
  size?: "sm" | "md";
  variant?: "memo-diary" | "latest-curated";
  value?: "MEMO" | "DIARY" | "latest" | "curated";
  onChange?: (value: "MEMO" | "DIARY") => void;
}

const DiaryModeSwitch = ({ className, size = "md", variant = "memo-diary", value = "MEMO", onChange }: DiaryModeSwitchProps) => {
  const t = useTranslate();
  const options =
    variant === "latest-curated"
      ? [
          { key: "latest", label: t("lumina.latest"), active: value === "latest" || value === "MEMO", disabled: false },
          { key: "curated", label: t("lumina.curated"), active: false, disabled: true },
        ]
      : [
          { key: "MEMO", label: t("common.memos"), active: value === "MEMO", disabled: false },
          { key: "DIARY", label: t("lumina.diary"), active: value === "DIARY", disabled: false },
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
          onClick={() => {
            if (option.key === "MEMO" || option.key === "DIARY") {
              onChange?.(option.key);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DiaryModeSwitch;
