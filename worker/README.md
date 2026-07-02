# Memos Cloudflare Worker

This directory is the standalone Cloudflare backend rewrite. It intentionally does not modify or reuse the existing Go server runtime.

For complete environment-variable and startup instructions, see [`../README.cloudflare.md`](../README.cloudflare.md).

## Stack

- Hono for HTTP routing.
- Clerk for session verification.
- D1 for structured metadata.
- R2 for attachment objects.
- Cloudflare Email Service `send_email` binding for notification email.
- Scheduled Workers for retry, cleanup, and stats jobs.

## Local Setup

1. Install dependencies:

   ```bash
   cd worker && pnpm install
   ```

2. Create local secrets in `.dev.vars`:

   ```bash
   CLERK_SECRET_KEY=...
   CLERK_PUBLISHABLE_KEY=...
   CLERK_JWT_KEY=...
   ```

3. Configure Cloudflare Email Service for deployed environments:

   ```toml
   [[send_email]]
   name = "EMAIL"
   ```

   The notification sender must be verified in Cloudflare Email Service. Worker notification settings use `fromEmail`, `fromName`,
   and `replyTo`; SMTP host, port, username, and password are ignored by this backend.

4. Apply local migrations:

   ```bash
   cd worker && pnpm db:migrate:local
   ```

5. Run the worker:

   ```bash
   cd worker && pnpm dev
   ```

## Current Status

This Worker now contains the skeleton, Clerk auth middleware, local user sync, D1/R2 bindings, initial D1 schema, memo/attachment/share/reaction/shortcut routes, RSS, MCP shell, Cloudflare Email Service test-email support, and compatibility aliases for the main old `/api/v1` resource routes.

Intentional or pending gaps:

- SSE is removed and returns 410; clients must poll.
- Built-in password auth, old OAuth IdP CRUD, PATs, linked identities, webhooks, AI transcription, and inbox notifications return explicit `not_implemented` responses.
- The React app uses the REST + Clerk frontend cutover.
- Attachment create is multipart/R2-first and does not implement old JSON byte-content upload.
