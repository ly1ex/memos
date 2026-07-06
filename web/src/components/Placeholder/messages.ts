// Future i18n: swap these for `t("placeholder.<variant>")` lookups via
// react-i18next without touching the component.
export const DEFAULT_MESSAGES = {
  empty: "No memos yet",
  loading: "Loading…",
  noResults: "Nothing matches that search",
  notFound: "This page is missing",
} as const;

export type PlaceholderVariant = keyof typeof DEFAULT_MESSAGES;
