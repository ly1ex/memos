# Cloudflare REST Edition Setup

This document describes how to run the Cloudflare Worker backend and the React frontend after the Clerk/REST cutover.

## Prerequisites

- Node.js 24. The repo declares Node `>=24`, but use Node 24 for now; Node 25 can break Corepack when launching pnpm 11.
- pnpm 11 through Corepack.
- A Cloudflare account with D1, R2, Workers, and Email Service enabled.
- A Clerk application.

Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@11.0.1 --activate
```

## Clerk Values

Create a Clerk application and copy these values:

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key, usually starts with `pk_test_` or `pk_live_`.
- `CLERK_SECRET_KEY`: Clerk secret key, usually starts with `sk_test_` or `sk_live_`.
- `CLERK_JWT_KEY`: optional JWT public key. Use this if you want Worker token verification without relying only on the secret key.
- `CLERK_AUTHORIZED_PARTIES`: comma-separated allowed frontend origins.

For local development:

```text
CLERK_AUTHORIZED_PARTIES=http://localhost:3001,http://localhost:8787
```

For production, use your deployed frontend URL instead.

In the Clerk dashboard, allow the frontend origin and callback URLs used by the routed Clerk components:

```text
http://localhost:3001
http://localhost:3001/auth/sso-callback
http://localhost:3001/auth/signup/sso-callback
```

For production, add the same paths under your deployed frontend origin.

## Worker Environment

Create `worker/.dev.vars` for local development:

```dotenv
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWT_KEY=
CLERK_AUTHORIZED_PARTIES=http://localhost:3001,http://localhost:8787
CORS_ORIGINS=http://localhost:3001,http://localhost:8787
```

`CLERK_SECRET_KEY` or `CLERK_JWT_KEY` must be present for authenticated routes. `CORS_ORIGINS` should include every frontend origin that can call the Worker.

For deployed Workers, set secrets with Wrangler:

```bash
cd worker
corepack pnpm wrangler secret put CLERK_SECRET_KEY
corepack pnpm wrangler secret put CLERK_JWT_KEY
```

Non-secret values live in `worker/wrangler.toml`:

```toml
[vars]
CORS_ORIGINS = "https://your-app.example.com"
CLERK_AUTHORIZED_PARTIES = "https://your-app.example.com"
```

## Cloudflare Bindings

`worker/wrangler.toml` must define these bindings:

```toml
[[d1_databases]]
binding = "DB"
database_name = "memos-cloudflare"
database_id = "your-d1-database-id"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "memos-attachments"

[[send_email]]
name = "EMAIL"
```

Create production resources when needed:

```bash
cd worker
corepack pnpm wrangler d1 create memos-cloudflare
corepack pnpm wrangler r2 bucket create memos-attachments
```

Copy the generated D1 `database_id` into `worker/wrangler.toml`.

For Cloudflare Email Service, verify the sender address/domain in Cloudflare and keep the binding name as `EMAIL`. The app notification settings use `fromEmail`, `fromName`, and `replyTo`; SMTP host, port, username, password, TLS, and SSL are not used in this edition.

## Frontend Environment

Create `web/.env.local`:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
DEV_PROXY_SERVER=http://localhost:8787
```

`DEV_PROXY_SERVER` is optional because Vite now defaults to `http://localhost:8787`. Set it only if the Worker runs elsewhere.

## Install Dependencies

From the repo root:

```bash
cd worker
corepack pnpm install

cd ../web
corepack pnpm install
```

After dependency changes, update the frontend lockfile:

```bash
cd web
corepack pnpm install --lockfile-only
```

## Local Database

Apply local D1 migrations:

```bash
cd worker
corepack pnpm db:migrate:local
```

Apply remote migrations before deploying:

```bash
cd worker
corepack pnpm db:migrate:remote
```

## Start Locally

Terminal 1, start the Worker REST API:

```bash
cd worker
corepack pnpm dev
```

Wrangler normally serves the Worker on `http://localhost:8787`.

Terminal 2, start the frontend:

```bash
cd web
corepack pnpm dev
```

Open `http://localhost:3001`. The frontend calls the Worker through Vite proxy routes for `/api`, `/file`, and `/mcp`.

## Verify

Run Worker checks:

```bash
cd worker
corepack pnpm typecheck
corepack pnpm test
```

Run frontend checks after `web/node_modules` is installed:

```bash
cd web
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

## Deployment

Deploy the Worker:

```bash
cd worker
corepack pnpm deploy
```

Build the frontend:

```bash
cd web
corepack pnpm build
```

Host the built frontend with your Cloudflare Pages or static hosting workflow. Route `/api/*`, `/file/*`, and `/mcp` to the Worker.

## Current API Contract

- Frontend API calls use `web/src/api/client.ts`.
- Frontend data shapes are plain TypeScript DTOs in `web/src/api/types.ts`.
- Worker responses are REST JSON with a `{ "data": ... }` success envelope and `{ "error": ... }` failure envelope.
- Authentication is Clerk session bearer tokens.
- Realtime refresh uses polling, not SSE.
