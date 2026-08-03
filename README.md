# Revorbit

> AI-powered GitHub Pull Request review platform

Revorbit is a GitHub App that automatically reviews pull requests with AI. When a developer opens or updates a pull request, Revorbit verifies the webhook, authenticates as the installed GitHub App, retrieves the changed files, sends the relevant code to an AI model, and posts review comments back to GitHub as inline comments — including a "Commit suggestion" for each fix.

## How it works

1. A developer opens or synchronizes a pull request on a repository where Revorbit is installed.
2. GitHub sends a `pull_request` webhook to the Revorbit API.
3. The API verifies the webhook signature, upserts the repository, and enqueues a review job on Redis (BullMQ).
4. A worker picks up the job, fetches the changed files, and sends the diff to the configured AI model.
5. The AI returns issues grouped by category (security, bugs, best practices, code quality, maintainability, performance).
6. The worker posts an inline review comment to GitHub for each issue — with the exact `problemCode` and a `fixedCode` rendered as a ```` ```suggestion ```` block.
7. Results are persisted to the database and shown on the dashboard.

## Monorepo structure

```text
revorbit/
├── apps/
│   ├── api/                  # Hono backend (REST APIs, webhooks, auth)
│   ├── web/                  # Next.js dashboard (port 3001)
│   └── worker/               # Background worker (AI review jobs)
│
├── packages/
│   ├── ai/                   # AI providers, prompts, output parsing
│   ├── database/             # Prisma schema & migrations
│   ├── github/               # GitHub App auth, webhooks, API wrapper
│   ├── logger/               # Shared structured logging
│   ├── queue/                # BullMQ queue wrapper
│   ├── shared/               # Common types, constants & utilities
│   ├── ui/                   # Shared UI components
│   ├── validators/           # Shared input validation
│   ├── eslint-config/        # Shared ESLint config
│   └── typescript-config/    # Shared TypeScript config
│
├── infrastructure/           # Docker, Kubernetes, monitoring, Terraform
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Architecture rule:** Apps are things you run. Packages are code you import. Apps depend on packages, never the other way around.

## Tech stack

- **Backend:** TypeScript, Node.js, Hono, Zod
- **Frontend:** Next.js, React, TailwindCSS, shadcn/ui
- **Database:** PostgreSQL + Prisma
- **Queue & cache:** Redis, BullMQ
- **Orchestration:** Turborepo, pnpm workspaces
- **AI:** Any OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Ollama, LM Studio, etc.)

## Getting started

### Prerequisites

- Node.js >= 18
- pnpm 9
- A PostgreSQL database (local, or Neon for serverless)
- Redis (local, or Upstash / Redis Cloud)
- A GitHub App (see [GitHub App setup](#github-app-setup))
- An OpenAI-compatible AI provider API key

### Install

```bash
pnpm install
```

### Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (or use `REDIS_HOST`/`REDIS_PORT`/...) |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `GITHUB_WEBHOOK_SECRET` | Secret used to sign GitHub webhooks |
| `GITHUB_PRIVATE_KEY` / `GITHUB_PRIVATE_KEY_PATH` | GitHub App private key |
| `AI_API_KEY` | API key for your AI provider |
| `AI_BASE_URL` | OpenAI-compatible base URL (empty for OpenAI) |
| `AI_MODEL` | Model name (e.g. `gpt-4o-mini`) |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `CORS_ORIGIN` / `WEB_ORIGIN` | Dashboard origin (e.g. `http://localhost:3001`) |

### Database setup

```bash
pnpm --filter database exec prisma migrate deploy
```

### Run locally

```bash
pnpm dev
```

This starts all apps via Turborepo:

- API on `http://localhost:3000`
- Dashboard on `http://localhost:3001`
- Worker connects to Redis and processes review jobs

### Optional: Docker for Postgres + Redis

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
```

## GitHub App setup

1. Go to **Settings → Developer settings → GitHub Apps** and create a new app.
2. Set the **Webhook URL** to `https://<your-tunnel-or-domain>/api/v1/github/webhook`.
3. Set a **Webhook secret** and use the same value for `GITHUB_WEBHOOK_SECRET`.
4. Grant **Repository permissions**: *Pull requests* (read/write), *Contents* (read), *Checks* (read).
5. Subscribe to the **Pull request** webhook event.
6. Install the app on your repositories.
7. Download the app private key (`*.pem`) and point `GITHUB_PRIVATE_KEY_PATH` to it.

For local development behind a tunnel, any HTTP tunnel works. On Windows, start `cloudflared` against the API's IPv4 loopback address (not `localhost`, which can resolve to IPv6):

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages and apps |
| `pnpm check-types` | Type-check all packages and apps |
| `pnpm format` | Format all TypeScript/TSX/markdown files |

## How reviews are generated

- Changed files are fetched from GitHub as diffs and chunked (`packages/ai/src/chunker.ts`).
- Each chunk is sent to the AI model with a system prompt (`packages/ai/src/prompts.ts`) that asks for issues across six categories, with **security as the highest priority**.
- The model returns strict JSON: a summary plus comments with `filePath`, `line`, `severity`, `title`, `body`, `problemCode`, and `fixedCode`.
- The worker validates the response (`packages/ai/src/parser.ts`), then posts it to GitHub as inline comments (`apps/worker/src/index.ts`).
- Comments with a `fixedCode` render on GitHub with a **Commit suggestion** button, so the reviewer can apply the fix in one click.

## Review categories

Revorbit asks the AI to check issues in priority order:

1. **Security** — hardcoded secrets, unsafe code execution, injection, insecure auth, exposed data.
2. **Bugs** — logic errors, race conditions, null/undefined access, incorrect error handling.
3. **Best practices** — improper patterns, missing error handling, unsafe type usage, deprecated APIs.
4. **Code quality** — duplication, dead code, unclear naming, complex functions.
5. **Maintainability** — tight coupling, missing tests, hard-to-change configuration.
6. **Performance** — N+1 queries, unnecessary re-renders, blocking operations, unbounded memory.

At most 10 issues are reported per review, and only confident ones — style-only nits are ignored.

## Repository settings

Each repository can be configured per its `RepositorySettings` record:

- `enabled` — whether Revorbit reviews this repo.
- `model` — the AI model used for this repo (overrides the global default).
- `maxFiles` — max number of changed files to send to the model.
- `maxTokens` — max tokens for the AI response.

## Infrastructure

`infrastructure/` contains:

- `docker/` — Dockerfiles and a compose file for Postgres, Redis, and the worker.
- `kubernetes/` — Kubernetes manifests.
- `terraform/` — Terraform infrastructure.
- `monitoring/` — Monitoring configuration.

## License

TBD
