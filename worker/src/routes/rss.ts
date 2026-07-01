import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { listPublicMemos } from "../repositories/memos";
import { getUserByUsername } from "../repositories/users";
import { renderMemoRss } from "../rss/xml";

export const rssRoutes = new Hono<AppEnv>();

rssRoutes.get("/explore/rss.xml", async (c) => {
  const memos = await listPublicMemos(c.env.DB, { limit: 50 });
  return new Response(
    renderMemoRss({
      title: "Memos Explore",
      siteUrl: new URL(c.req.url).origin,
      memos
    }),
    {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8"
      }
    }
  );
});

rssRoutes.get("/u/:username/rss.xml", async (c) => {
  const user = await getUserByUsername(c.env.DB, c.req.param("username"));
  if (!user) {
    throw new HttpError(404, "not_found", "User not found");
  }

  const memos = await listPublicMemos(c.env.DB, { creatorId: user.id, limit: 50 });
  return new Response(
    renderMemoRss({
      title: `${user.nickname || user.username} - Memos`,
      siteUrl: new URL(c.req.url).origin,
      memos
    }),
    {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8"
      }
    }
  );
});
