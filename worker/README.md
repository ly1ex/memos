# Memos Cloudflare Worker

This directory is the standalone Cloudflare backend rewrite. It intentionally does not modify or reuse the existing Go server runtime.

## Stack

- Hono for HTTP routing.
- Clerk for session verification.
- D1 for structured metadata.
- R2 for attachment objects.
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

3. Apply local migrations:

   ```bash
   cd worker && pnpm db:migrate:local
   ```

4. Run the worker:

   ```bash
   cd worker && pnpm dev
   ```

## Current Status

This is the first implementation slice. It contains the Worker skeleton, Hono app wiring, Clerk auth middleware, local user sync, D1/R2 bindings, initial D1 schema, MCP protocol shell, and not-implemented placeholders for the larger memo and attachment API surface.

