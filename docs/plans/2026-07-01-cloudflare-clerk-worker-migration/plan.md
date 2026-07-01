# Cloudflare + Clerk Worker Migration Plan

## Feasibility Summary

This migration is feasible, but it is a backend rewrite rather than an in-place deployment change. The current Go backend depends on Echo, Connect RPC, gRPC-Gateway, a driver-based SQL store, in-memory SSE fanout, local/S3 attachment storage, and Go background runners. Cloudflare Workers cannot run that service shape directly. The target should be a new TypeScript Worker backend that preserves the product behavior selected for this edition and exposes a REST JSON API for the React frontend.

Target platform:

- Auth: Clerk replaces the built-in auth stack.
- API backend: Cloudflare Worker, preferably TypeScript + Hono.
- Database: Cloudflare D1, D1 stores structured rows and metadata only.
- Object storage: Cloudflare R2, all attachment binaries live in R2.
- Frontend hosting: Cloudflare Pages.
- Realtime: SSE is removed; React Query polling becomes the refresh model.
- Jobs: Go runners are removed; scheduled and retry work moves to Scheduled Workers, Queues, and `ctx.waitUntil()`.
- MCP: must remain available as a Worker `/mcp` endpoint.

Platform constraints that shape the design:

- D1 is a SQLite-compatible service but not a general replacement for local SQLite files. On Workers Paid, a database is limited to 10 GB, a row/string/blob is limited to 2 MB, bound parameters are limited to 100 per query, `LIKE`/`GLOB` patterns are limited to 50 bytes, and each database processes queries serially. See Cloudflare D1 limits: <https://developers.cloudflare.com/d1/platform/limits/>.
- Workers have a 128 MB memory limit per isolate and request body limits by plan. Free/Pro inbound request body size is 100 MB, which directly affects attachment upload through Worker. See Cloudflare Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>.
- R2 is the right location for attachment binaries. R2 supports large objects, but single request upload through Worker is still constrained by Worker request limits. See Cloudflare R2 limits: <https://developers.cloudflare.com/r2/platform/limits/>.
- Clerk frontend-to-backend calls should pass Clerk session tokens as `Authorization: Bearer <token>` for cross-origin requests. Backend verification should use Clerk `authenticateRequest()` or `verifyToken()` with `jwtKey` and `authorizedParties`. See Clerk authenticated requests and token verification docs: <https://clerk.com/docs/guides/development/making-requests>, <https://clerk.com/docs/guides/sessions/manual-jwt-verification>, <https://clerk.com/docs/reference/backend/verify-token>.

## Target Architecture

### Runtime Topology

- `web/` continues to build the React/Vite SPA, deployed by Cloudflare Pages.
- A new Worker project, proposed path `worker/`, owns all backend routes under `/api/v1/*`, `/file/*`, `/explore/rss.xml`, `/u/:username/rss.xml`, and `/mcp`.
- Pages routes `/api/*`, `/file/*`, `/explore/*`, `/u/*`, and `/mcp` to the Worker. SPA routes continue to resolve from Pages assets.
- D1 is bound as `DB`.
- R2 is bound as `ATTACHMENTS`.
- Clerk secrets and public keys are Worker environment variables:
  - `CLERK_SECRET_KEY`
  - `CLERK_PUBLISHABLE_KEY`
  - `CLERK_JWT_KEY`
  - `CLERK_AUTHORIZED_PARTIES`
- Optional provider secrets for mail, AI transcription, and webhook signing remain Worker secrets.

### Application Layers

The Worker should be organized by behavior rather than by the old Go package layout:

- HTTP layer: Hono route definitions, request parsing, response envelope, CORS, error mapping.
- Auth layer: Clerk token verification, local user sync, role loading, admin checks.
- Service layer: memo, attachment, share, reaction, shortcut, setting, inbox, RSS, MCP operations.
- Persistence layer: D1 query helpers and typed repository functions.
- Object layer: R2 key generation, upload, download, deletion, range support, metadata checks.
- Job layer: scheduled handlers, queue consumers, retry records, cleanup routines.

Do not port the Go `store.Driver` abstraction. D1 is the only database target in this edition, so repository functions can use D1 SQL directly with shared helpers for pagination, transactions, and named error mapping.

## Scope Decisions

### Remove

- Connect RPC compatibility.
- gRPC-Gateway compatibility.
- Generated protobuf TypeScript client dependency in the frontend API path.
- Built-in username/password sign-in.
- Built-in OAuth IdP configuration and callback flow.
- PAT support.
- Local attachment storage.
- S3-compatible attachment storage.
- S3 presign refresh runner.
- SQLite/MySQL/PostgreSQL multi-driver support.
- Go server runtime, Go store runtime, and Go runner runtime for the Cloudflare edition.
- SSE realtime refresh.

### Keep Or Rebuild

- Memo CRUD, filtering, archive/delete behavior, visibility, payload extraction.
- Memo comments implemented as memo relations.
- Memo relations, reactions, shares, shortcuts.
- Instance settings and user settings that are still meaningful after Clerk migration.
- Inbox notifications.
- Email and webhook delivery, with Worker-native job scheduling.
- RSS endpoints.
- Attachment metadata and access control.
- AI transcription endpoint if provider configuration is available in Worker secrets.
- MCP endpoint.

### Defer

- Large direct-to-R2 multipart upload. MVP uploads go through Worker and obey Worker request size limits.
- D1 sharding or per-user databases. MVP uses one D1 database for the instance.
- Full text search parity. MVP keeps indexed filters and may add D1 FTS5 after core migration.
- Durable Object based realtime. Polling is the target for this migration.

## Public API Shape

The Worker API should expose REST JSON. Keep endpoint names close to the existing `/api/v1` surface so the frontend migration is mostly client-adapter work.

Authentication:

- `GET /api/v1/auth/me`
- `POST /api/v1/users:sync`
- `POST /api/v1/auth/signout` can become a no-op or return Clerk redirect metadata; Clerk owns session termination.

Instance:

- `GET /api/v1/instance/profile`
- `GET /api/v1/instance/settings/:key`
- `GET /api/v1/instance/settings:batchGet`
- `PATCH /api/v1/instance/settings/:key`
- `GET /api/v1/instance/stats`

Users:

- `GET /api/v1/users/:username`
- `GET /api/v1/users:batchGet`
- `PATCH /api/v1/users/:username`
- `GET /api/v1/users/:username/settings`
- `PATCH /api/v1/users/:username/settings`
- Admin-only user list/update endpoints where still needed.

Memos:

- `GET /api/v1/memos`
- `POST /api/v1/memos`
- `GET /api/v1/memos/:id`
- `PATCH /api/v1/memos/:id`
- `DELETE /api/v1/memos/:id`
- `GET /api/v1/memos/:id/comments`
- `POST /api/v1/memos/:id/comments`
- `GET /api/v1/memos/:id/attachments`
- `POST /api/v1/memos/:id/attachments`
- `PUT /api/v1/memos/:id/attachments`
- `GET /api/v1/memos/:id/relations`
- `PUT /api/v1/memos/:id/relations`
- `GET /api/v1/memos/:id/reactions`
- `PUT /api/v1/memos/:id/reactions/:reactionType`
- `DELETE /api/v1/memos/:id/reactions/:reactionType`
- `GET /api/v1/memos/:id/link-metadata`

Attachments:

- `POST /api/v1/attachments`
- `GET /api/v1/attachments`
- `GET /api/v1/attachments/:id`
- `PATCH /api/v1/attachments/:id`
- `DELETE /api/v1/attachments/:id`
- `POST /api/v1/attachments:batchDelete`
- `GET /file/attachments/:uid/:filename`

Shares:

- `POST /api/v1/memos/:id/shares`
- `GET /api/v1/memos/:id/shares`
- `DELETE /api/v1/memos/:id/shares/:shareId`
- `GET /api/v1/shares/:shareId`

Shortcuts, RSS, and MCP:

- `GET /api/v1/shortcuts`
- `POST /api/v1/shortcuts`
- `PATCH /api/v1/shortcuts/:id`
- `DELETE /api/v1/shortcuts/:id`
- `GET /explore/rss.xml`
- `GET /u/:username/rss.xml`
- `POST /mcp`

Use one consistent error envelope:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "Permission denied"
  }
}
```

Use cursor pagination for list APIs. The cursor should encode stable ordering fields such as `created_ts` and `id`, not offset.

## Clerk Auth Design

Clerk owns identity and sessions. The application owns local authorization.

### Frontend

- Add `@clerk/react`.
- Wrap the app in `ClerkProvider`.
- Replace `web/src/auth-state.ts` and token refresh logic with Clerk session access.
- Replace Connect clients in `web/src/connect.ts` with a typed fetch client.
- The fetch client calls `getToken()` and sends `Authorization: Bearer <token>` for authenticated requests.
- Remove frontend assumptions about app-issued access tokens, refresh cookies, and BroadcastChannel token sync.

### Worker

- Verify Clerk tokens on protected routes.
- Prefer `authenticateRequest()` with `jwtKey` for networkless verification when possible.
- Configure `authorizedParties` to include the Pages origin and local dev origin.
- Build an auth context:
  - `clerkUserId`
  - `sessionId`
  - `localUser`
  - `role`
  - `isAdmin`
- Public routes are only those explicitly declared public: instance profile, public memo/share reads, RSS, file reads that pass visibility/share checks, and MCP initialize if the MCP protocol requires unauthenticated initialization.

### Local User Sync

The first authenticated request should create or update the local user row:

- `clerk_user_id` is the stable identity key.
- `email`, `nickname`, `avatar_url`, and display fields are synced from Clerk when available.
- The first local user can become admin if no admin exists, matching the current first-user bootstrap behavior.
- Local `user.role` remains the app authorization source.

## D1 Data Model

D1 stores structured data only. Binary data must not be stored in D1.

### Core Tables

The initial D1 schema should be derived from the existing SQLite schema, then simplified for the Cloudflare edition:

- `system_setting`
- `user`
- `user_setting`
- `memo`
- `memo_relation`
- `attachment`
- `reaction`
- `memo_share`
- `inbox`
- `shortcut` if it is not fully represented inside `user_setting`
- `job_queue` for retryable background work
- `stat_snapshot` for scheduled aggregate output if stats become expensive to compute live

Drop or do not create:

- `idp`
- `user_identity` for built-in OAuth IdP linkage
- password-specific fields
- attachment blob fields
- multi-driver migration compatibility structures

### User Table

Required logical fields:

- `id`
- `clerk_user_id TEXT NOT NULL UNIQUE`
- `username TEXT NOT NULL UNIQUE`
- `email TEXT`
- `nickname TEXT`
- `avatar_url TEXT`
- `role TEXT NOT NULL`
- `row_status TEXT NOT NULL`
- `created_ts INTEGER NOT NULL`
- `updated_ts INTEGER NOT NULL`

`password_hash` is removed. Login secrets are never stored in D1.

### Memo Table

Preserve the product semantics:

- `id`
- `uid`
- `creator_id`
- `content`
- `visibility`
- `row_status`
- `payload_json`
- `pinned`
- `created_ts`
- `updated_ts`

Indexes should cover:

- `(creator_id, row_status, created_ts, id)`
- `(visibility, row_status, created_ts, id)`
- `(row_status, created_ts, id)`

Avoid wide or unbounded `LIKE` filters in MVP because of D1 `LIKE`/`GLOB` pattern limits. Tag and property filters should use extracted metadata where possible. If content search is required, add FTS5 in a separate phase.

### Attachment Table

All binary data goes to R2. D1 only stores metadata:

- `id`
- `uid`
- `creator_id`
- `memo_id`
- `filename`
- `type`
- `size`
- `r2_key TEXT NOT NULL`
- `r2_bucket TEXT`
- `sha256`
- `metadata_json`
- `created_ts`
- `updated_ts`

Access control is resolved through the owning memo, share token, or creator role. The R2 bucket should remain private; do not expose raw public R2 URLs for protected attachments.

### Settings And JSON

Keep proto JSON concepts as plain JSON text for the Cloudflare edition. Do not depend on generated protobuf JSON types in Worker code. Validate setting payloads with TypeScript schemas before writing D1.

## R2 Attachment Flow

### Upload

1. Authenticated user posts file data to `POST /api/v1/attachments`.
2. Worker validates filename, content type, size, and upload permission.
3. Worker generates `uid` and R2 key, for example `attachments/{uid}/{safeFilename}`.
4. Worker streams the request body to R2 where possible.
5. Worker writes D1 attachment metadata only after R2 write succeeds.
6. Worker returns attachment metadata including `uid`, filename, type, size, and API download path.

MVP upload must stay within Worker request body limits. Do not accept files that exceed the configured limit. Return `413 payload_too_large`.

### Download

1. Request hits `GET /file/attachments/:uid/:filename`.
2. Worker loads attachment metadata from D1.
3. Worker checks memo visibility, share access, or owner/admin permission.
4. Worker reads from R2 and streams the response.
5. Support `Range` requests for media playback.
6. Return correct `Content-Type`, `Content-Length`, `ETag`, and cache headers.

### Delete And Cleanup

- Delete API marks or deletes D1 metadata and schedules R2 deletion.
- Scheduled cleanup scans for orphaned R2 objects and orphaned D1 attachment rows.
- Failed R2 deletes are retried through `job_queue` or Queues.

## Polling Instead Of SSE

Remove `/api/v1/sse` and the in-memory SSE hub.

Frontend behavior:

- Memo list queries use a conservative `refetchInterval`, for example 15-30 seconds when the tab is visible.
- Memo detail and inbox queries can poll only while visible.
- Mutations continue to invalidate React Query caches immediately.
- Background tabs should pause or lengthen polling through React Query focus/online managers.

Backend behavior:

- No long-lived SSE connection route is required.
- No Durable Object is required for MVP realtime.
- If realtime is later required, add Durable Object fanout as a separate feature.

## Background Work

The Go runner model must be replaced by Worker-native scheduling.

### Remove

- S3 presign refresh runner. R2 objects are read through the Worker, and no S3 presigned URL refresh is needed.

### Scheduled Worker Jobs

Use scheduled handlers for:

- Mail delivery retry.
- Webhook delivery retry.
- Orphan attachment cleanup.
- Soft-deleted row cleanup if desired.
- Stats aggregation into `stat_snapshot`.

### Request-Tail Work

Use `ctx.waitUntil()` for short work that can safely complete after a response:

- Enqueue webhook delivery records.
- Enqueue notification email records.
- Best-effort metadata extraction that does not affect the response.

### Retryable Queue Work

Use Cloudflare Queues or a D1-backed `job_queue` table for work that must survive failures:

- Webhook delivery with retry count and next attempt timestamp.
- Email delivery with retry count and next attempt timestamp.
- R2 cleanup retry.

The MVP can use a D1 `job_queue` table and Scheduled Worker polling to reduce moving parts. Move to Cloudflare Queues if delivery volume grows.

## MCP Requirement

MCP must be rebuilt for the Worker backend.

Target route:

- `POST /mcp`

Protocol:

- Keep Streamable HTTP behavior.
- Keep a curated memo-focused tool catalog rather than exposing every internal endpoint.
- Tool calls should execute through the same service functions as REST handlers, not duplicate authorization logic.

Initial tool allowlist:

- `list_memos`
- `get_memo`
- `create_memo`
- `update_memo`
- `delete_memo`
- `list_memo_comments`
- `create_memo_comment`
- `list_memo_attachments`
- `set_memo_attachments`
- `list_memo_reactions`
- `upsert_memo_reaction`
- `delete_memo_reaction`
- `list_memo_relations`
- `set_memo_relations`
- `list_attachments`
- `get_attachment`
- `delete_attachment`

Authentication:

- MCP tool calls that read or write protected data require the same Clerk auth context as REST.
- If MCP clients cannot use Clerk browser sessions, support a Clerk machine token or documented bearer session token flow. Do not reintroduce PAT as part of this migration.

## Frontend Migration

Main changes:

- Add Clerk provider and sign-in/sign-up routes or components.
- Replace `web/src/connect.ts` with a fetch client.
- Replace generated proto request/response assumptions with TypeScript API types owned by the frontend or shared Worker package.
- Remove refresh-token and access-token storage from `web/src/auth-state.ts`.
- Update React Query hooks to call REST endpoints.
- Replace SSE invalidation hook with polling defaults.
- Keep optimistic updates for memo mutations.
- Update attachment upload to send files to Worker and store returned R2-backed metadata.

The frontend should not know R2 object keys. It should only use attachment API paths returned by the Worker.

## Migration Strategy

### Fresh Cloudflare Edition

1. Create D1 database and R2 bucket.
2. Apply D1 migrations.
3. Configure Clerk application and allowed origins.
4. Deploy Worker.
5. Deploy Pages frontend.
6. First signed-in user becomes admin if no admin exists.

### Existing Memos Data

Build a one-time migration script that reads the existing database and attachment storage:

1. Export users, memos, relations, reactions, shares, settings, inbox rows, and attachment metadata.
2. Create or map Clerk users.
3. Write D1 users with `clerk_user_id`.
4. Write D1 memo-related rows in dependency order.
5. Upload every attachment binary to R2.
6. Write D1 attachment metadata with `r2_key`.
7. Generate a report for unmapped users, failed files, duplicate usernames, and skipped unsupported settings.

User mapping policy:

- Match Clerk users by verified email when possible.
- Fall back to a manual mapping file for username-only users.
- Do not import password hashes.
- Do not import built-in OAuth IdP configuration.
- Do not import PATs.

Attachment mapping policy:

- Existing DB blobs and local files are both uploaded to R2.
- Existing S3 attachments are copied into R2.
- D1 stores only R2 metadata after migration.

## Implementation Milestones

### M1: Worker Skeleton

- Create `worker/` TypeScript project.
- Add Wrangler config with D1/R2 bindings.
- Add Hono app, error envelope, health route, and auth middleware.
- Add local dev instructions.
- Add Vitest setup with mocked D1/R2.

Validation:

- `cd worker && pnpm test`
- `cd worker && pnpm wrangler dev`

### M2: D1 Schema And Repositories

- Add D1 migrations.
- Implement repositories for users, memos, relations, attachments, shares, reactions, settings, inbox, jobs.
- Add transaction helpers and cursor pagination helpers.

Validation:

- Fresh D1 migration succeeds.
- Repository tests cover CRUD and permission-critical lookup paths.

### M3: Clerk Auth And User Sync

- Add Clerk middleware.
- Add `auth/me` and `users:sync`.
- Implement first-user admin bootstrap.
- Remove frontend token refresh assumptions.

Validation:

- Unauthenticated protected request returns 401.
- Valid Clerk token creates/loads local user.
- First user becomes admin only when no admin exists.

### M4: Memo And Attachment MVP

- Implement memo CRUD/list/detail/comment/relation/share.
- Implement R2 attachment upload/download/delete.
- Port markdown payload extraction logic or implement a TypeScript-compatible subset required by existing UI.

Validation:

- Create, update, delete memo.
- Add comment.
- Upload attachment, link to memo, download via `/file`.
- Public/protected/private visibility checks pass.

### M5: Frontend API Cutover

- Add Clerk UI/provider.
- Replace Connect clients with REST fetch client.
- Update React Query hooks.
- Replace SSE with polling.
- Update attachment upload and download paths.

Validation:

- `cd web && pnpm lint`
- `cd web && pnpm test`
- `cd web && pnpm build`

### M6: Jobs, RSS, MCP

- Add scheduled job handlers.
- Add webhook/email retry flow.
- Add cleanup and stats scheduled jobs.
- Rebuild RSS endpoints.
- Rebuild `/mcp` endpoint and memo-focused tool catalog.

Validation:

- Scheduled handler dry runs.
- Webhook/email retry state transitions.
- RSS XML response snapshots.
- MCP initialize, tools/list, and tools/call tests.

### M7: Migration And Deployment

- Add export/import migration scripts.
- Add R2 upload migration.
- Add deployment docs for D1, R2, Worker, Pages, Clerk.
- Run end-to-end migration against a sample database.

Validation:

- Sample migration report has no unexpected failures.
- Pages + Worker production preview supports login, memo CRUD, attachment upload/download, RSS, and MCP.

## Test Matrix

Worker unit tests:

- Clerk token missing, invalid, expired, and valid.
- Admin-only route access.
- Memo visibility checks for owner, other authenticated user, anonymous user, and share token.
- D1 cursor pagination stability.
- D1 bound-parameter limit avoidance for batch APIs.
- Attachment upload validation.
- Attachment download range request.
- R2 write succeeds and D1 write fails cleanup path.
- D1 write succeeds and R2 delete retry path.
- Webhook/email retry scheduling.
- MCP tool auth and argument validation.

Frontend tests:

- Signed-out user sees Clerk sign-in flow.
- Signed-in user loads `auth/me`.
- Memo list polling refreshes data without duplicate rows.
- Memo mutation invalidates the right query keys.
- Attachment upload shows returned metadata and download URL.
- Private attachment cannot be fetched anonymously.

Integration tests:

- Fresh D1 migration.
- Worker routes under Pages-style paths.
- Clerk test token against Worker auth middleware.
- R2 upload/download using Miniflare or Wrangler local bindings.
- Scheduled handler dry run.
- MCP protocol smoke tests.

Manual acceptance:

- Create first admin via Clerk.
- Create public, protected, and private memos.
- Comment on memo.
- Upload and download image/audio/document attachments.
- Create share and read shared memo anonymously.
- Confirm list pages update by polling after another tab changes data.
- Trigger webhook/email retry job.
- Use MCP client to list and create memos.

## Risk Register

- D1 throughput: each database processes queries serially. Mitigation: index all list filters, use cursor pagination, keep transactions short, avoid large batch mutations.
- D1 storage: 10 GB per database is enough for metadata but not attachment binaries. Mitigation: R2-only attachment storage.
- D1 query limits: 100 bound parameters and 50-byte `LIKE`/`GLOB` pattern limit can break naive filters. Mitigation: avoid giant `IN` lists and long content search patterns; use batching and FTS5 later.
- Worker memory: buffering attachments can exceed 128 MB. Mitigation: stream request/response bodies and enforce upload size limits.
- Auth semantic drift: Clerk replaces built-in password/OAuth/PAT flows. Mitigation: document this as an intentional product cut and keep local roles in D1.
- SSE removal: users lose instantaneous background refresh. Mitigation: tune React Query polling and mutation invalidation.
- MCP auth: existing MCP clients may not have browser Clerk sessions. Mitigation: define a bearer token flow using Clerk-compatible tokens, not PAT.
- Migration user mapping: password-only users cannot be automatically authenticated after migration. Mitigation: map by email and produce manual remediation report.
- Background retries: `ctx.waitUntil()` is not enough for durable retry. Mitigation: use D1 `job_queue` or Cloudflare Queues for must-run work.

## Acceptance Criteria

- The Cloudflare edition deploys with Pages + Worker + D1 + R2 + Clerk and does not require the Go server.
- D1 contains no attachment binary blobs.
- R2 contains all uploaded attachment objects.
- Clerk is the only login/session provider.
- Built-in password auth, OAuth IdP, PAT, local storage, S3 presign runner, Connect/gRPC compatibility, and multi-database drivers are absent from the Cloudflare edition.
- Memo core workflows work through REST JSON.
- Frontend refresh works through polling and mutation invalidation, with no SSE route dependency.
- Scheduled Worker handles mail, webhook, cleanup, and stats jobs.
- `/mcp` exists and can call curated memo tools with the same authorization rules as REST.
