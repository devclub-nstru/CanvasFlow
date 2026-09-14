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
COPY apps/menti/package.json apps/menti/package.json

COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/observability/package.json packages/observability/package.json
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

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, and
# .dockerignore keeps .env out of the build context — so without these the web
# image ships pointing at http://localhost:8000 no matter what the runtime
# environment says. They are public values by definition; never add a secret.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MENTI_API_URL
ARG NEXT_PUBLIC_API_URLS
# Every canonical link, OG url, sitemap entry and JSON-LD id is built from this
# at prerender time. Missing, it falls back to http://localhost:3000 — and the
# deployed site then tells search engines its canonical home is localhost.
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MENTI_API_URL=$NEXT_PUBLIC_MENTI_API_URL
ENV NEXT_PUBLIC_API_URLS=$NEXT_PUBLIC_API_URLS
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

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

# ============================================================
# Menti (live presentations service)
#
# Plain ESM JavaScript — nothing to compile, so this copies the source as-is
# together with the workspace node_modules the deps stage installed. The pnpm
# symlinks under apps/menti/node_modules point back into /app/node_modules/.pnpm,
# which is why both trees have to be copied and kept at the same paths.
# ============================================================

FROM node:24-bookworm-slim AS menti

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/menti ./apps/menti

# cwd matters: storage.service.js resolves its upload directory from
# process.cwd(), and index.js serves /uploads from the same place.
WORKDIR /app/apps/menti

EXPOSE 8080

CMD ["node", "index.js"]


# ============================================================
# Menti PowerPoint worker
#
# Same code as the menti stage plus the two binaries the import pipeline shells
# out to: LibreOffice converts .pptx to PDF, poppler's pdftoppm rasterises the
# pages. The fonts are not optional — without them LibreOffice substitutes and
# every rendered slide comes out with the wrong metrics.
# ============================================================

FROM menti AS menti-worker

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-impress \
        poppler-utils \
        fonts-dejavu \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/menti

CMD ["node", "src/workers/pptxWorker.js"]
