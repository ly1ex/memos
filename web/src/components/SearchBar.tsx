import { SearchIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useTranslate } from "@/utils/i18n";
import MemoDisplaySettingMenu from "./MemoDisplaySettingMenu";

const SearchBar = () => {
  const t = useTranslate();
  const { addFilter } = useMemoFilterContext();
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedText = queryText.trim();
    if (trimmedText !== "") {
      const words = trimmedText.split(/\s+/);
      words.forEach((word) => {
        addFilter({
          factor: "contentSearch",
          value: word,
        });
      });
      setQueryText("");
    }
  };

  return (
    <form className="lumina-inline-search lumina-liquid-glass" onSubmit={handleSubmit}>
      <SearchIcon className="lumina-inline-search-icon" />
      <input
        className="lumina-inline-search-input"
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={onTextChange}
        ref={inputRef}
      />
      {queryText && (
        <button type="button" className="lumina-inline-search-clear" onClick={() => setQueryText("")} aria-label={t("common.clear")}>
          <XIcon className="size-4" />
        </button>
      )}
      <span className="lumina-inline-search-divider" aria-hidden="true" />
      <MemoDisplaySettingMenu className="lumina-inline-search-menu" />
    </form>
  );
};

export default SearchBar;
