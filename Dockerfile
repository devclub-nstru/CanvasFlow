# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app


# ============================================================
# Dependencies
# ============================================================

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy only package manifests first.
# This keeps the dependency layer cached when source code changes.
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json

COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/redis/package.json packages/redis/package.json
COPY packages/services/package.json packages/services/package.json
COPY packages/trpc/package.json packages/trpc/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile


# ============================================================
# Build
# ============================================================

FROM deps AS build

COPY . .

RUN pnpm build


# ============================================================
# API
# ============================================================

FROM node:24-bookworm-slim AS api

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/apps/api/dist ./apps/api/dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages ./packages

COPY --from=build /app/apps/api/package.json ./apps/api/package.json

EXPOSE 8000

CMD ["node", "apps/api/dist/index.js"]


# ============================================================
# Worker
# ============================================================

FROM node:24-bookworm-slim AS worker

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/apps/worker/dist ./apps/worker/dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/packages ./packages

COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/index.js"]


# ============================================================
# Database migration
# ============================================================

FROM node:24-bookworm-slim AS migrate

ENV NODE_ENV=production

WORKDIR /app/packages/database

COPY --from=build /app/packages/database ./

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/database/node_modules ./node_modules

CMD ["node", "migrate.mjs"]


# ============================================================
# Web
# ============================================================

FROM node:24-bookworm-slim AS web

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node", "server.js"]