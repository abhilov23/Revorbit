# ReviewForge

> AI-powered GitHub Pull Request Review Platform

## Monorepo Structure

```text
reviewforge/
├── apps/
│   ├── api/                  # Hono Backend
│   ├── web/                  # Next.js Frontend
│   ├── worker/               # Background Workers
│   └── sandbox/              # Code Execution Sandbox
│
├── packages/
│   ├── ai/                   # AI Providers & Prompting
│   ├── auth/                 # Authentication & Authorization
│   ├── cache/                # Redis Abstraction
│   ├── config/               # Environment & Configuration
│   ├── database/             # Drizzle ORM & Database Layer
│   ├── github/               # GitHub API Wrapper
│   ├── logger/               # Shared Logger
│   ├── observability/        # Metrics & Tracing
│   ├── queue/                # BullMQ Wrapper
│   ├── review-engine/        # AI Review Business Logic
│   ├── security/             # Security Utilities
│   ├── shared/               # Shared Helpers & Constants
│   ├── storage/              # File Storage
│   ├── types/                # Shared Types
│   ├── ui/                   # Shared React Components
│   └── validators/           # Zod Schemas
│
├── infrastructure/
│   ├── docker/               # Dockerfiles
│   ├── kubernetes/           # Kubernetes Manifests
│   ├── monitoring/           # Prometheus / Grafana
│   └── terraform/            # Infrastructure as Code
│
├── scripts/                  # Utility Scripts
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

# Folder Purpose

## Apps

Applications that can be started independently.

| Folder | Purpose |
|---------|---------|
| `api` | Hono backend (REST APIs, GitHub webhooks, authentication) |
| `web` | Next.js frontend dashboard |
| `worker` | Background jobs (AI reviews, processing) |
| `sandbox` | Safe execution of untrusted code |

---

## Packages

Reusable code shared across applications.

| Folder | Purpose |
|---------|---------|
| `ai` | AI providers, prompts, structured outputs |
| `auth` | Authentication & authorization |
| `cache` | Redis wrapper |
| `config` | Environment variables & configuration |
| `database` | Drizzle ORM, schemas & migrations |
| `github` | GitHub API wrapper |
| `logger` | Shared logging |
| `observability` | Metrics, tracing & monitoring |
| `queue` | BullMQ wrapper |
| `review-engine` | Core AI review logic |
| `security` | Encryption, webhook verification, rate limiting |
| `shared` | Common utilities & helpers |
| `storage` | File storage abstraction |
| `types` | Shared TypeScript types |
| `ui` | Shared React components |
| `validators` | Shared Zod validation schemas |

---

## Infrastructure

Deployment and DevOps configuration.

| Folder | Purpose |
|---------|---------|
| `docker` | Dockerfiles & Docker Compose |
| `kubernetes` | Kubernetes manifests |
| `monitoring` | Prometheus, Grafana, Loki, etc. |
| `terraform` | Cloud infrastructure |

---

## Scripts

Utility scripts for development and maintenance.

Examples:

- Database seeding
- Code generation
- Cleanup scripts
- Automation tasks

---

## Architecture Rule

```
Apps
    │
    ▼
Packages
    │
    ▼
Infrastructure
```

- **Apps** = Things you run.
- **Packages** = Code you import.
- **Infrastructure** = Code that deploys everything.