<div align="center">

# CanvasFlow

**A canvas-first form builder with durable data keys and real-time analytics.**

Drag fields onto an open canvas, connect them like nodes, watch responses light up your dashboard. Built as a Turborepo monorepo with a Next.js studio, an Express + tRPC API, a BullMQ worker for file uploads, and a Drizzle / PostgreSQL data layer with Redis for caching, rate limiting, and queues.

</div>

---

## Highlights

- **Canvas-first builder** powered by [`@xyflow/react`](https://reactflow.dev). Sixteen field types: short / long text, email, phone, URL, number, select, radio, checkbox, rating, slider, toggle, date, time, datetime, and file upload.
- **Durable field keys.** Every field gets an immutable slug the moment it's created — rename labels freely and your webhooks, exports, and analytics never break.
- **Real-time analytics.** Response timeline, device breakdown, day-of-week, completion rate, submissions table with virtualisation and CSV export.
- **One submission per visitor.** Partial unique index on `(form_id, visitor_id)` with a client-side lockout screen — visitors can't submit twice even by clearing localStorage.
- **Idempotency on every submit.** A client-generated `idempotency_key` collapses double-clicks and network retries into a single record.
- **Segments and conditional branching.** Forms split into pages, with if/else rules that weigh several answers at once and route to a question, a segment, or the end.
- **Optimistic-lock versioning** on forms and fields so concurrent edits surface conflicts instead of silently overwriting.
- **Asynchronous file uploads.** The API parks a file on disk and returns `202` immediately; a BullMQ worker ships it to Cloudinary and publishes status through Redis. Uploads are bound to a submission at submit time by a claim token, so an abandoned form never leaks a stored file into someone else's response.
- **Collaborators.** Forms can be shared as `viewer` or `editor`, with ownership transfer. Permissions are resolved server-side per request and returned alongside the form.
- **Resumable drafts.** Signed-in respondents get their answers and page position persisted per `(form, user)`, so a half-finished form survives a closed tab.
- **In-app feedback widget** writing to a triaged `feedback` table (type, status, priority).
- **Menti — live presentations.** A Mentimeter-style presenter, audience, and results experience (bar graph, word cloud, scales, content, quiz, leaderboard) with PowerPoint import. See [Menti](#menti-live-presentations) — it is served by the web app but backed by a **separate service**, not by this repo's API.

## Tech stack

| Layer          | Choice                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Monorepo       | Turborepo + pnpm workspaces                                                            |
| Web app        | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Radix UI primitives, Motion |
| Canvas builder | `@xyflow/react`                                                                        |
| Charts         | Recharts (lazy-loaded per route)                                                       |
| API            | Express 5 + tRPC 11 (OpenAPI generated via `trpc-to-openapi`)                          |
| Auth           | Hand-rolled JWT sessions (`cf_jwt` cookie), PBKDF2 passwords, Google + GitHub OAuth     |
| DB             | PostgreSQL via Drizzle ORM, `pg` connection pool, migrations via `drizzle-kit`         |
| Validation     | Zod (shared between client, server, and OpenAPI schema)                                |
| State / data   | TanStack Query (tRPC React Query adapter)                                              |
| Cache / limits | Redis (ioredis) — form bundle cache, upload status, GCRA rate limiting                 |
| Queue / worker | BullMQ on Redis; a standalone worker process consumes upload jobs                      |
| File storage   | Cloudinary (image / video / raw), written only by the worker                            |
| Logging        | Winston                                                                                |

## Architecture

```
apps/
  web/     Next.js 16 studio — landing, auth, dashboard, builder, public form pages, Menti
  api/     Express + tRPC server, OpenAPI bridge, rate limiting, auth mount, upload intake
  worker/  BullMQ consumer — uploads a parked file to Cloudinary, then marks it ready

packages/
  database/        Drizzle schema, models, migrations, shared pg pool
  services/        Pure business logic (form, field, segment, logic, draft, submission, upload, feedback)
  trpc/            tRPC router + shared client; auth, context, route definitions
  queue/           BullMQ queue + worker factories and job contracts
  redis/           ioredis client, cache helpers, key namespacing
  logger/          Winston wrapper used by api, worker, and services
  eslint-config/   Shared ESLint config (Next + Prettier)
  typescript-config/  Shared tsconfig presets
```

The `services` package is framework-agnostic — all SQL, validation, and business rules live there. `trpc` is a thin transport layer that calls services, and `apps/api` only owns process lifecycle (express, CORS, rate-limit, multer intake, scalar docs). `apps/worker` shares the same services and talks to the same database, but consumes jobs instead of HTTP requests.

Redis is optional in development and the app degrades rather than failing: without it the form-bundle cache misses through to Postgres and rate limiting falls back to per-process counters. File uploads are the one exception — they require a queue, and the API returns `503` for upload requests when `REDIS_URL` is unset.

## Getting started

### Prerequisites

- **Node ≥ 20** (`engines` is pinned)
- **pnpm 9**
- **Docker** — the bundled `docker-compose.yml` runs Postgres 15 for local
  development. Any other PostgreSQL server works too; just point
  `DATABASE_URL` at it and skip `pnpm db:up`.

### 1. Install

```sh
pnpm install
```

### 2. Configure environment

The repo expects a single `.env` at the root that is hard-linked into every workspace by `setup.sh`. The session signing secret, database URL, Redis URL, Cloudinary credentials, and OAuth credentials all live here.

```sh
cp .env.example .env   # if you have one, otherwise create from the template below
bash setup.sh          # links the root .env into apps/*/.env and packages/*/.env
```

Minimum required keys:

```env
# API
PORT=8000
NODE_ENV=development
BASE_URL=http://localhost:8000

# Database — matches the bundled docker-compose Postgres.
# POSTGRES_PORT is the host port compose publishes and must match the
# port in DATABASE_URL. 5434 (not 5432) so it can coexist with other
# Postgres containers on the same machine.
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/dev
POSTGRES_PORT=5434

# Sessions. Every session token is signed with this value, so there is no
# safe default: the API refuses to boot in production when it is unset, and
# in development it falls back to a well-known insecure string and warns.
# BETTER_AUTH_SECRET is accepted as an alias for backwards compatibility.
JWT_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:8000
WEB_URL=http://localhost:3000

# Redis — matches the bundled docker-compose. Optional in development:
# without it the cache misses through to Postgres, rate limiting falls back
# to per-process counters, and file uploads are disabled (503).
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=cf

# Cloudinary — where the worker stores uploaded files. Without these the
# worker starts, warns, and fails upload jobs with a clear message.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=canvasflow

# File uploads. The API parks incoming files here and the worker reads them
# back, so both processes must resolve this to the SAME directory — under
# Docker, a shared volume (docker-compose.prod.yml wires one up).
UPLOAD_TMP_DIR=
UPLOAD_MAX_MB=10

# Web
NEXT_PUBLIC_API_URL=http://localhost:8000
# Optional: extra API origins to allow in web CSP connect-src (comma-separated)
# Example: NEXT_PUBLIC_API_URLS=http://localhost:8080,http://localhost:9000
NEXT_PUBLIC_API_URLS=
# Optional: the separate Menti service. Leave blank to disable that feature.
NEXT_PUBLIC_MENTI_API_URL=http://localhost:8080

# Optional — OAuth providers (server skips them gracefully if absent)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

`.env.example` is the authoritative list; the block above is only the subset
you need to boot.

### 3. Set up the database

```sh
pnpm db:up        # start the Postgres and Redis containers, wait until healthy
pnpm db:migrate   # apply the committed Drizzle migrations
```

`pnpm db:up` uses `docker compose up -d --wait`, so it doesn't return until
Postgres actually accepts TCP connections. Without that wait, a `db:migrate`
fired immediately after start loses the race and fails with `ECONNREFUSED`.

You only need `pnpm db:generate` when you've _changed_ `schema.ts` and want a
new migration file — it is not part of first-time setup.

### 4. Run dev

```sh
pnpm dev
```

`dev` runs `db:up` first, so the database is guaranteed to be listening
before the API boots. Use `pnpm dev:no-db` if you're pointing
`DATABASE_URL` at a server you manage yourself.

This boots, in parallel:

| URL                                  | What                                     |
| ------------------------------------ | ---------------------------------------- |
| `http://localhost:3000`              | Next.js studio (web)                     |
| `http://localhost:8000/trpc`         | tRPC HTTP endpoint                       |
| `http://localhost:8000/docs`         | Auto-generated Scalar API reference      |
| `http://localhost:8000/openapi.json` | OpenAPI 3.1 spec                         |
| `http://localhost:8000/health`       | Liveness probe used by the compose stack |
| _(no port)_                          | `@repo/worker` — BullMQ upload consumer  |

Sign up at `/signUp`, build a form, publish it, share `/forms/<id>`, watch responses populate `/dashboard/analytics`.

## Scripts

All scripts are turbo-orchestrated and `dotenv -- ...` wrapped so workspaces share the root env.

| Script             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Start Postgres + Redis, then run every workspace's dev task |
| `pnpm dev:no-db`   | Same, without touching Docker                       |
| `pnpm build`       | Build the API, worker, and web app for production   |
| `pnpm lint`        | ESLint across all workspaces (zero-warning)         |
| `pnpm check-types` | TypeScript no-emit type-check                       |
| `pnpm format`      | Prettier across `**/*.{ts,tsx,md}`                  |
| `pnpm db:up`       | Start the Postgres + Redis containers, wait until healthy |
| `pnpm db:down`     | Stop them, keeping the data volumes                 |
| `pnpm db:logs`     | Tail Postgres logs                                  |
| `pnpm db:psql`     | Open a `psql` shell inside the container            |
| `pnpm db:reset`    | **Destroys the volume**, recreates, re-migrates     |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes    |
| `pnpm db:migrate`  | Apply pending migrations                            |

`db:migrate` and `db:generate` are marked `"cache": false` in `turbo.json`.
They mutate a database / write files, so a turbo cache hit would report
"migrations applied successfully" while doing nothing — which silently
leaves the schema behind whenever you switch `DATABASE_URL` to a different
server.

Filter to a single workspace with `pnpm -F web <script>` or `pnpm -F @repo/api <script>`.

## Design decisions worth knowing

- **Single-statement dashboard query.** `form.getDashboardStats` is one SQL `WITH owned AS (...)` CTE that returns `forms`, totals, per-form counts, and the 90-day trend as JSON in a single round-trip. The pg pool is also pre-warmed with four sockets at boot, so the first burst of concurrent queries doesn't pay parallel TLS handshakes against a remote server. Result: dashboard loads in ~250ms warm and stays under 300ms even when fired alongside other authed calls.
- **`Server-Timing` headers** are emitted from every authed tRPC procedure (`auth;dur=… inner;dur=…`). Visible in DevTools Network panel — useful for diagnosing whether a slow request was auth or query.
- **React Query staleTime caching** on dashboard / list / analytics hooks (30–60s) so in-app back-navigation paints instantly. Mutations always `invalidate()` on success, so stale data can't survive a real write.
- **Visitor lockout** is enforced in three places: the UI hides the form behind a `cf_submitted_<formId>` localStorage flag, the API service does a `(form_id, visitor_id)` lookup before insert, and a partial unique index on the same tuple wins races at the DB level.
- **Field type validation in the public form** does format checks for `EMAIL` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and `URL` (`new URL()`) — both block forward navigation and surface a sonner toast.
- **Code splitting.** Recharts widgets and the heaviest analytics components are loaded via `next/dynamic` per route. The submissions virtualised table mounts its detail modal only when a row is clicked.
- **Question layout** is a per-form setting (`forms.question_layout`) with an `AUTO` default that reads the form's shape: one question per page until a second segment exists, then a page per segment. The author can override to one-question, one-segment, or everything-at-once.
- **Uploads never block a submit.** `POST /uploads/:formId/:fieldId` authorises the field, streams the file to a temp directory, records a `pending` row, enqueues a BullMQ job, and returns `202` with a `claimToken`. The worker uploads to Cloudinary and republishes status to Redis; the browser polls `GET /uploads/:uploadId` with that token. At submit time the service *claims* matching uploads into the submission — a token that doesn't match, or a file already bound to another submission, is silently dropped rather than attached.
- **Permanent vs retryable upload failures.** The worker distinguishes them: a bad file, a size rejection, or a temp file that no longer exists fails the job immediately with a respondent-safe message, while a transient network error is retried with exponential backoff (4 attempts). Raw provider errors and server paths never reach the respondent.
- **Rate limiting is GCRA**, evaluated in a single atomic Lua script in Redis and keyed by session fingerprint, then visitor cookie, then peer address. When Redis is unavailable it degrades to the identical algorithm in-process rather than disabling itself: with N clustered workers a client gets up to N times the intended budget, which still bounds abuse where no limit at all would not.
- **The form bundle is cached as one object** (`form + fields + segments + logic rules`) for 30s, with the submission count cached separately for 15s, so a public form page costs one Redis read on the hot path. Every mutation that can change the bundle invalidates it explicitly.
- **Auth is deliberately small.** Sessions are JWTs in an HttpOnly `cf_jwt` cookie, with a readable `cf_session` companion so Next middleware can gate `/dashboard` without a round-trip. Passwords are PBKDF2-SHA512, and the OAuth code exchange for Google and GitHub is done by hand. There is no safe default for the signing secret, so the API refuses to boot in production without `JWT_SECRET`.

## Repository layout

```
.
├── apps
│   ├── api               # Express + tRPC, auth mount, upload intake, Scalar docs
│   ├── worker            # BullMQ consumer — uploads files to Cloudinary
│   └── web               # Next.js 16 studio
├── packages
│   ├── database          # Drizzle schema + models + migrations + pg pool
│   ├── services          # Business logic (form, field, segment, logic, draft, submission, upload, feedback)
│   ├── trpc              # Server router + shared client + procedures
│   ├── queue             # BullMQ queue/worker factories + job contracts
│   ├── redis             # ioredis client, cache helpers, key namespacing
│   ├── logger            # Winston wrapper
│   ├── eslint-config     # Shared ESLint config
│   └── typescript-config # Shared tsconfig presets
├── Dockerfile            # Multi-stage: deps → build → api / worker / migrate / web
├── docker-compose.yml    # Local Postgres + Redis for development
├── docker-compose.prod.yml  # Production stack (postgres, redis, migrate, api, worker, web)
├── setup.sh              # Hard-links root .env into every workspace
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Menti — live presentations

The web app also ships **Menti**, a Mentimeter-style live presentation feature: an
editor with a slide sidebar and PowerPoint import, a presenter view with a QR join
card, an audience view, and a results view. Six slide types (bar graph, word cloud,
scales, content, quiz, leaderboard) are wired through a registry as
editor / viewer / audience triples in [`components/menti`](apps/web/components/menti).

**It is not backed by this repo's API.** Every Menti call — REST and the Socket.io
realtime channel — goes to a separate service at `NEXT_PUBLIC_MENTI_API_URL`
(default `http://localhost:8080`). There are no Menti tables in the Drizzle schema
and no Menti routes in the tRPC router. Leave that variable unset and the rest of
CanvasFlow runs normally; the Menti pages will simply fail to load their data.

## Deployment

`Dockerfile` is multi-stage and builds one shared dependency/build layer into four
runnable targets: `api`, `worker`, `migrate`, and `web`.
`docker-compose.prod.yml` wires those together with Postgres and Redis, and
`.github/workflows/ci-cd.yml` type-checks and builds every push, then deploys
`main` over SSH.

Two constraints are easy to miss and both are enforced in the compose file:

- **The API and worker must share the upload directory.** The API only parks files
  on disk; the worker reads them back. They run in separate containers, so
  `UPLOAD_TMP_DIR` is overridden to a path backed by a shared volume. Without it
  the worker fails every job with "the uploaded file is no longer available".
- **`stop_grace_period` is 30s.** Both processes drain for up to 25s on `SIGTERM`;
  Docker's 10s default would `SIGKILL` them mid-flight on every deploy.

## Contributing

1. Branch off `main`.
2. Run `pnpm check-types && pnpm lint` before pushing.
3. Add a Drizzle migration (`pnpm db:generate`) for any schema change and commit both the SQL and the snapshot JSON.
4. Keep business logic in `packages/services`; the tRPC layer should stay thin.

## License

[MIT](./LICENSE) © Dittya Maity
