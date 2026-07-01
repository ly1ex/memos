export interface MemoPayload {
  tags: string[];
}

export function buildMemoPayload(content: string): MemoPayload {
  return {
    tags: extractTags(content)
  };
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const pattern = /(^|\s)#([A-Za-z0-9][A-Za-z0-9_/-]{0,63})/g;
  for (const match of content.matchAll(pattern)) {
    tags.add(match[2]);
  }
  return [...tags].sort();
}

