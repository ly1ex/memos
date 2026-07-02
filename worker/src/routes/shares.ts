import { Hono } from "hono";

import type { AppEnv } from "../env";
import { HttpError } from "../http/errors";
import { ok } from "../http/responses";
import { getSharedMemo } from "../repositories/memo-shares";
import { toMemoResponse } from "../serializers/memos";
import { toMemoShareResponse } from "../serializers/shares";

export const shareRoutes = new Hono<AppEnv>();

shareRoutes.get("/:shareId", async (c) => {
  const shared = await getSharedMemo(c.env.DB, c.req.param("shareId"));
  if (!shared) {
    throw new HttpError(404, "not_found", "Share not found");
  }

  return c.json(
    ok({
      share: toMemoShareResponse(shared.share),
      memo: toMemoResponse(shared.memo)
    })
  );
});
