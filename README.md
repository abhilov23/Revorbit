<img width="2800" height="560" alt="revorbit-hero-banner" src="https://github.com/user-attachments/assets/3448affd-d811-4197-a6f6-397670c4ca93" />


Revorbit is a GitHub App that automatically reviews pull requests with AI. When a developer opens or updates a pull request, Revorbit verifies the webhook, authenticates as the installed GitHub App, retrieves the changed files, sends the relevant code to an AI model, and posts review comments back to GitHub as inline comments — including a "Commit suggestion" for each fix.

## How it works

1. A developer opens, updates or marks a pull request ready on a repository where Revorbit is installed.
2. GitHub sends a `pull_request` webhook to the Revorbit API.
3. The API verifies the webhook signature, claims the delivery id, upserts the repository, and enqueues a review job on Redis (BullMQ) carrying identifiers only.
4. A worker re-fetches the pull request and its changed files from GitHub, then sends the diff to the configured AI model.
5. The AI returns a summary plus findings, each with a category, severity, and a suggested fix.
6. Each finding is resolved to a real diff position; only those are posted as inline review comments, with the rest folded into the review body.
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
│   ├── github/               # GitHub App auth, webhooks, diff mapping, API wrapper
│   ├── logger/               # Shared structured logging
│   ├── queue/                # BullMQ queue wrappers (reviews, issues)
│   ├── shared/               # Common types, roles, autonomy, constants & utilities
│   ├── validators/           # Shared input validation
│   ├── eslint-config/        # Shared ESLint config
│   └── typescript-config/    # Shared TypeScript config
│
├── infrastructure/           # Docker (compose + worker image)
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
| `SESSION_SECRET` | Signs the session cookie (min 16 chars) |
| `RESEND_API_KEY` | Resend API key for password-reset email. Required in production; without it, development logs the message instead of sending it |
| `WORKER_CONCURRENCY` | Reviews processed in parallel by the worker |
| `MAX_BODY_BYTES` | Maximum accepted request body size |
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
| `pnpm test` | Run the unit tests |
| `pnpm format` | Format all TypeScript/TSX/markdown files |

### Testing

Tests use Node's built-in test runner (`node:test`) via `tsx` — no test framework
dependency. They cover the logic where a mistake is expensive and the code is pure:

- **`packages/shared`** — autonomy-to-capability mapping, including that the ladder is
  monotonic and never grants a capability at OBSERVE.
- **`packages/github`** — diff position resolution for added, deleted, context, multi-hunk,
  new-file and deleted-file diffs, plus the unmapped-finding fallback path.
- **`packages/ai`** — generated-fix path validation (traversal, CI workflows, secrets,
  lockfiles), review-response parsing against the severity and category unions, and diff
  chunking.

Run with `pnpm test`. GitHub and AI integrations are never called for real.

## How reviews are generated

- Changed files are fetched from GitHub as diffs and chunked (`packages/ai/src/chunker.ts`).
- Each chunk is sent to the AI model with a system prompt (`packages/ai/src/prompts.ts`) built from the repository's role, enabled focus areas, and custom instructions. Disabled focus areas are omitted from the prompt entirely.
- The model returns strict JSON: a summary plus comments with `filePath`, `line`, `severity`, `title`, `body`, `problemCode`, and `fixedCode`.
- The worker validates the response (`packages/ai/src/parser.ts`), drops any comment referencing a file that was not actually sent to the model, then posts the rest to GitHub as inline comments (`apps/worker/src/index.ts`).
- Chunks are reviewed with bounded concurrency, and a single failed chunk is logged rather than discarding the findings from the chunks that succeeded.
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

## Review behavior

Each repository carries its own review profile, edited from the dashboard under
**AI behavior** or **Repository settings**:

- **Role** (`REVIEWER`, `SECURITY_RESEARCHER`, `DEVELOPER`, `HELPER`) — sets the reviewer's lens
  and which findings it leads with. Role prompts are centralised in `packages/ai/src/prompts.ts`.
- **Focus areas** (`security`, `correctness`, `performance`, `style`) — disabled areas are
  removed from the system prompt entirely, so the reviewer stops reporting on them. With every
  area disabled, a review returns no findings.
- **Custom instructions** — free text appended to the system prompt alongside the role.
- **Model**, **max files**, and **max tokens** — per-repository limits that override the global defaults.

Every finding carries a **category** (`bug`, `security`, `performance`, `quality`,
`maintainability`, `architecture`) and a **severity** (`info`, `low`, `medium`, `high`, `critical`).

A review is only ever reported as a GitHub comment; nothing is applied automatically.

### Partial reviews

A pull request is split into diff chunks and analysed with bounded concurrency. If some chunks
fail — a provider timeout, malformed output — the surviving findings are kept, the review is
persisted with `partial: true`, and the dashboard and the GitHub review body both state that the
review does not cover the entire pull request. A partial review is never presented as complete.

## Autonomy

Each repository is configured with how much authority Revorbit has:

| Level | Capabilities granted |
| --- | --- |
| `OBSERVE` | `ANALYZE` |
| `SUGGEST` | `ANALYZE`, `COMMENT` |
| `PROPOSE` | `ANALYZE`, `COMMENT`, `CREATE_BRANCH`, `COMMIT_CHANGES`, `CREATE_PR` |
| `AUTONOMOUS` | the above plus `REQUEST_CHANGES` |

Autonomy is never compared directly at a call site. Every GitHub write resolves its required
capability through `hasCapability` / `assertCapability` in `packages/shared/src/autonomy.ts`, so
the authority model lives in exactly one place. `OBSERVE` repositories are analysed and stored but
never posted to GitHub.

## Issue intelligence

Issues opened on connected repositories are triaged automatically: classified (`bug`, `feature`,
`security`, `documentation`, `performance`, `other`) with a confidence score, the files likely to
need changing, and a proposed implementation approach.

Commenting `revorbit fix` on an issue (or using **Propose fix** in the dashboard) asks for a
proposed fix. This requires the repository's autonomy to be at least `PROPOSE`. Revorbit then
creates `revorbit/fix-<number>`, commits the generated files, and opens a **draft** pull request.
Drafts are never merged by Revorbit.

Whether a fix is available is computed server-side from the repository's autonomy and returned as
`canGenerateFix`, so the dashboard reflects the rule that actually gates the operation rather than
re-implementing it in the browser. The endpoint re-checks regardless.

Issue bodies and repository content are untrusted input. The analysis prompts label them as data
and keep the output contract outside the untrusted block.

## Password reset

`/forgot-password` issues a single-use, one-hour token and emails a reset link. Only a SHA-256
hash of the token is stored, so a database read cannot mint reset links. Accounts created
through GitHub OAuth have no password and cannot use this flow.

Delivery goes through a pluggable mailer: with `RESEND_API_KEY` set it sends via Resend;
without it, development logs the message (including the link) instead. Production requires
`RESEND_API_KEY` and refuses to boot without it.

## Security notes

- Sessions are opaque Redis keys whose cookie value is HMAC-signed with `SESSION_SECRET`. A
  secondary index tracks every session per user, so a password reset revokes all of them — a
  session stolen before the reset does not survive it.
- The session cookie's `Secure` flag follows the configured `WEB_ORIGIN` scheme, not `NODE_ENV`,
  so a staging deployment served over HTTPS does not send the cookie in the clear.
- The GitHub OAuth `state` is single-use and verified against Redis, preventing login CSRF.
- Mutating requests are checked against an allow-list of origins. `SameSite=Lax` already blocks
  cross-site form posts, but the origin check also covers sibling-subdomain and top-level
  navigation cases. Requests with no `Origin` or `Referer` are rejected rather than trusted.
- Webhook payloads are verified with HMAC-SHA256 over the raw body before parsing. The webhook is
  exempt from the origin check because it is authenticated by signature, not by cookie.
- Webhook deliveries are claimed by `x-github-delivery` before any work, so GitHub redeliveries
  are no-ops. A failed delivery releases its claim so it can be retried.
- Every repository and review query is scoped to the caller's installation; cross-tenant access
  returns `404` rather than `403` so ids cannot be probed.
- Duplicate webhook deliveries cannot create a second review: a unique constraint covers
  `(repositoryId, pullNumber, headSha)`, BullMQ dedupes by `jobId`, and a previously failed review
  is reset and retried.
- Dashboard mutations accept an optional `Idempotency-Key`. A retry with the same key and body
  replays the cached response; the same key with a different body is rejected with `409`. This
  covers the cookie-auth case where an applied request is retried because its response was lost.
- Every GitHub write is gated on an autonomy capability resolved from repository settings.
- The credential endpoints (`/auth/login`, `/auth/signup`, password reset) are rate limited far
  more tightly than the rest of the API.
- Model output is validated against the files actually sent, so a prompt-injected model cannot
  attach invented findings to unrelated files.
- Job payloads carry identifiers only; the worker re-fetches pull requests and issues from GitHub
  when the job runs, so a large diff is never serialised into Redis.
- Generated fixes cannot write to arbitrary paths. Paths are normalised, rejected for traversal,
  absolute form, git internals, CI workflows, dotfiles, credentials and lockfiles, and bounded by
  file count and size. This matters because a merged fix is code execution.

### Idempotency

Three separate mechanisms cover three different failure modes:

| Scope | Mechanism |
| --- | --- |
| Webhook delivery | `x-github-delivery` claimed in the database before any work |
| Review creation | unique constraint on `(repositoryId, pullNumber, headSha)` |
| Queue jobs | BullMQ `jobId` derived from the review or issue id |
| Dashboard mutations | client-sent `Idempotency-Key` with a cached response |

## Diff-aware reviews

GitHub rejects a review outright when any comment references a line outside the diff. Findings are
therefore resolved against the patch before they are posted (`packages/github/src/diff.ts`):

- Each file's patch is parsed into the set of commentable line numbers on the left and right sides
  by walking the unified diff and tracking the old and new line cursors.
- A line present on both sides resolves to `RIGHT`, because the model is shown the patch where
  context and added lines are new-file numbering.
- A line that exists only on the old side — a deletion — resolves to `LEFT`.
- A finding with no anchorable line is never dropped and never snapped to a nearby line. It is
  published in the review body instead, with the reason stated.

Only validated comments reach `pulls.createReview`, so a single unmappable finding cannot fail the
whole review.

## Repository settings

Each repository can be configured per its `RepositorySettings` record:

- `enabled` — whether Revorbit reviews this repo.
- `role` — reviewer role (`REVIEWER`, `SECURITY_RESEARCHER`, `DEVELOPER`, `HELPER`).
- `security` / `correctness` / `performance` / `style` — which focus areas the prompt includes.
- `customPrompt` — extra instructions appended to the system prompt.
- `autonomyLevel` — how much authority the agent has (`OBSERVE` … `AUTONOMOUS`).
- `model` — the AI model used for this repo (overrides the global default).
- `maxFiles` — max number of changed files to send to the model.
- `maxTokens` — cap on the AI response length.

Account-level defaults live in `UserSettings` (default model, max files, default autonomy,
notification preferences) and are applied to repositories as they are connected. Existing
repositories keep their own settings and can be changed individually at any time.

## Review pipeline

```text
GitHub pull_request webhook
      ↓  claim delivery (idempotent)
create Review (unique on repo + pull number + head SHA)
      ↓  enqueue identifiers only
BullMQ "reviews" queue
      ↓
Worker re-fetches the pull request and its files from GitHub
      ↓  chunk the diff, bounded concurrency
AI (role + focus areas + custom instructions)
      ↓  validate JSON, drop unsent files, cap at 10
resolve each finding to a diff position (LEFT / RIGHT)
      ↓
persist (marking the review partial if chunks failed)
      ↓  autonomy gate on COMMENT
post inline comments + review body to GitHub
```

The same shape applies to issues, ending in a draft pull request when autonomy allows.

## Infrastructure

`infrastructure/` contains:

- `docker/` — a Dockerfile for the worker and a compose file for Postgres, Redis, and the worker.

## License

TBD
