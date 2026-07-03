import { describe, expect, it } from "vitest";

import { renderMemoRss } from "../src/rss/xml";

describe("RSS XML", () => {
  it("escapes memo content", () => {
    const xml = renderMemoRss({
      title: "Memos & Feed",
      siteUrl: "https://example.com/",
      memos: [
        {
          id: 1,
          uid: "memo_1",
          creatorId: 1,
          content: "Hello <world> & friends",
          visibility: "PUBLIC",
          entryType: "COMMUNITY",
          rowStatus: "NORMAL",
          pinned: false,
          payload: {},
          createdTs: 1,
          updatedTs: 1
        }
      ]
    });

    expect(xml).toContain("Memos &amp; Feed");
    expect(xml).toContain("Hello &lt;world&gt; &amp; friends");
    expect(xml).toContain("https://example.com/m/1");
  });
});
