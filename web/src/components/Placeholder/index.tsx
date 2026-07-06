import { FileQuestionIcon, InboxIcon, LoaderCircleIcon, SearchXIcon } from "lucide-react";
import { type ReactNode } from "react";
import LiquidGlass from "@/components/LiquidGlass";
import { cn } from "@/lib/utils";
import { DEFAULT_MESSAGES, type PlaceholderVariant } from "./messages";

interface PlaceholderProps {
  variant: PlaceholderVariant;
  message?: string;
  children?: ReactNode;
  className?: string;
}

const Placeholder = ({ variant, message, children, className }: PlaceholderProps) => {
  const resolvedMessage = message ?? DEFAULT_MESSAGES[variant];
  const isLoading = variant === "loading";
  const Icon =
    variant === "loading"
      ? LoaderCircleIcon
      : variant === "noResults"
        ? SearchXIcon
        : variant === "notFound"
          ? FileQuestionIcon
          : InboxIcon;

  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-live={isLoading ? "polite" : undefined}
      className={cn("lumina-placeholder flex flex-col items-center justify-center max-w-md mx-auto px-4 py-8", className)}
      data-placeholder-variant={variant}
    >
      <LiquidGlass className="lumina-placeholder-icon" radius="999px" blur="18px" interactive={!isLoading}>
        <Icon className={cn("size-7", isLoading && "animate-spin")} strokeWidth={1.8} />
      </LiquidGlass>
      <p className="mt-4 font-mono text-sm text-muted-foreground">{resolvedMessage}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Placeholder;
