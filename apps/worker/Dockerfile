FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @revorbit/database generate

CMD ["pnpm", "--filter", "worker", "start"]
