export interface MemoPayload {
  entryType: MemoEntryType;
  tags: string[];
}

export type MemoEntryType = "MEMO" | "DIARY" | "COMMUNITY";

export function buildMemoPayload(content: string, entryType: MemoEntryType = "MEMO"): MemoPayload {
  return {
    entryType,
    tags: extractTags(content)
  };
}

export function parseMemoEntryType(value: unknown, fallback: MemoEntryType = "MEMO"): MemoEntryType {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (value === "MEMO" || value === "DIARY" || value === "COMMUNITY") {
    return value;
  }
  return fallback;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const pattern = /(^|\s)#([A-Za-z0-9][A-Za-z0-9_/-]{0,63})/g;
  for (const match of content.matchAll(pattern)) {
    tags.add(match[2]);
  }
  return [...tags].sort();
}
