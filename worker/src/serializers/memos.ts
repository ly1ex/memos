import type { Memo } from "../repositories/memos";
import type { Reaction } from "../repositories/reactions";
import { stateFromRowStatus, timestampFromUnix } from "../utils/rest-json";
import { memoName, userName } from "../utils/resource-names";

export interface MemoResponse extends Memo {
  name: string;
  creator?: string;
  state: "NORMAL" | "ARCHIVED";
  createTime: string;
  updateTime: string;
  tags: string[];
  property: {
    hasLink: boolean;
    hasTaskList: boolean;
    hasCode: boolean;
    hasIncompleteTasks: boolean;
    title: string;
  };
  snippet: string;
  reactions?: Reaction[];
}

export function toMemoResponse(memo: Memo, reactions?: Reaction[]): MemoResponse {
  const tags = extractTags(memo.payload);
  return {
    ...memo,
    name: memoName(memo.uid),
    creator: memo.creatorUsername ? userName(memo.creatorUsername) : undefined,
    state: stateFromRowStatus(memo.rowStatus),
    createTime: timestampFromUnix(memo.createdTs),
    updateTime: timestampFromUnix(memo.updatedTs),
    tags,
    property: buildProperty(memo.content),
    snippet: buildSnippet(memo.content),
    reactions
  };
}

function extractTags(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const tags = (payload as Record<string, unknown>).tags;
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags.filter((tag): tag is string => typeof tag === "string");
}

function buildProperty(content: string): MemoResponse["property"] {
  return {
    hasLink: /https?:\/\//i.test(content),
    hasTaskList: /(^|\n)\s*[-*]\s+\[[ xX]\]/.test(content),
    hasCode: /```|`[^`]+`/.test(content),
    hasIncompleteTasks: /(^|\n)\s*[-*]\s+\[\s\]/.test(content),
    title: firstHeading(content)
  };
}

function buildSnippet(content: string): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_\-~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

function firstHeading(content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^#\s+(.+)$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}
