import type { Memo } from "../repositories/memos";

export function renderMemoRss(input: { title: string; siteUrl: string; memos: Memo[] }): string {
  const siteUrl = input.siteUrl.replace(/\/$/, "");
  const items = input.memos
    .map((memo) => {
      const link = `${siteUrl}/m/${memo.id}`;
      return [
        "    <item>",
        `      <title>${escapeXml(titleFromContent(memo.content))}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(memo.createdTs * 1000).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(memo.content)}</description>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(input.title)}</description>`,
    items,
    "  </channel>",
    "</rss>"
  ].join("\n");
}

function titleFromContent(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "Untitled memo";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

