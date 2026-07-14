<div align="center">

# CanvasFlow

**A canvas-first form builder with durable data keys and real-time analytics.**

Drag fields onto an open canvas, connect them like nodes, watch responses light up your dashboard. Built as a Turborepo monorepo with a Next.js studio, an Express + tRPC API, and a Drizzle / PostgreSQL data layer.

</div>

---

## Highlights

- **Canvas-first builder** powered by [`@xyflow/react`](https://reactflow.dev). Twelve field types: short / long text, email, phone, URL, number, single select, checkbox, rating, toggle, date, time.
- **Durable field keys.** Every field gets an immutable slug the moment it's created — rename labels freely and your webhooks, exports, and analytics never break.
- **Real-time analytics.** Response timeline, device breakdown, day-of-week, completion rate, submissions table with virtualisation and CSV export.
- **One submission per visitor.** Partial unique index on `(form_id, visitor_id)` with a client-side lockout screen — visitors can't submit twice even by clearing localStorage.
- **Idempotency on every submit.** A client-generated `idempotency_key` collapses double-clicks and network retries into a single record.
- **Pro-tier paywall** for detailed analytics, with Free / Pro / Pro+ / Business tiers wired into the API and UI.
- **Optimistic-lock versioning** on forms and fields so concurrent edits surface conflicts instead of silently overwriting.

## Tech stack

| Layer          | Choice                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Monorepo       | Turborepo + pnpm workspaces                                                            |
| Web app        | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Radix UI primitives, Motion |
| Canvas builder | `@xyflow/react`                                                                        |
| Charts         | Recharts (lazy-loaded per route)                                                       |
| API            | Express 5 + tRPC 11 (OpenAPI generated via `trpc-to-openapi`)                          |
| Auth           | Better Auth with email/password, Google OAuth, GitHub OAuth, signed cookie cache       |
| DB             | PostgreSQL via Drizzle ORM, `pg` connection pool, migrations via `drizzle-kit`         |
| Validation     | Zod (shared between client, server, and OpenAPI schema)                                |
| State / data   | TanStack Query (tRPC React Query adapter)                                              |
| Logging        | Winston                                                                                |

## Architecture

```
apps/
  web/    Next.js 16 studio — landing, auth, dashboard, builder, public form pages
  api/    Express + tRPC server, OpenAPI bridge, rate limiting, Better Auth mount

packages/
  database/        Drizzle schema, models, migrations, shared pg pool
  services/        Pure business logic (form / form-field / form-submission / analytics)
  trpc/            tRPC router + shared client; auth, context, route definitions
  logger/          Winston wrapper used by api and services
  eslint-config/   Shared ESLint config (Next + Prettier)
  typescript-config/  Shared tsconfig presets
```

The `services` package is framework-agnostic — all SQL, validation, and business rules live there. `trpc` is a thin transport layer that calls services, and `apps/api` only owns process lifecycle (express, CORS, rate-limit, scalar docs).

## Getting started

### Prerequisites

- **Node ≥ 20** (`engines` is pinned)
- **pnpm 9**
- A PostgreSQL database. Either:
  - a free [Neon](https://neon.tech) project (recommended), or
  - the bundled `docker-compose.yml` for local Postgres on port 5432.

### 1. Install

```sh
pnpm install
```

### 2. Configure environment

The repo expects a single `.env` at the root that is hard-linked into every workspace by `setup.sh`. The Better Auth secret, database URL, and OAuth credentials all live here.

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

# Database (Neon or local Postgres)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Better Auth
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:8000
WEB_URL=http://localhost:3000

# Web
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional — OAuth providers (server skips them gracefully if absent)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### 3. Set up the database

```sh
# Optional: spin up local Postgres
docker compose up -d

# Generate + apply Drizzle migrations
pnpm db:generate
pnpm db:migrate
```

### 4. Run dev

```sh
pnpm dev
```

This boots, in parallel:

| URL                                  | What                                |
| ------------------------------------ | ----------------------------------- |
| `http://localhost:3000`              | Next.js studio (web)                |
| `http://localhost:8000/trpc`         | tRPC HTTP endpoint                  |
| `http://localhost:8000/docs`         | Auto-generated Scalar API reference |
| `http://localhost:8000/openapi.json` | OpenAPI 3.1 spec                    |

Sign up at `/signUp`, build a form, publish it, share `/forms/<id>`, watch responses populate `/dashboard/analytics`.

## Scripts

All scripts are turbo-orchestrated and `dotenv -- ...` wrapped so workspaces share the root env.

| Script             | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Run every workspace's dev task                   |
| `pnpm build`       | Build the API and the web app for production     |
| `pnpm lint`        | ESLint across all workspaces (zero-warning)      |
| `pnpm check-types` | TypeScript no-emit type-check                    |
| `pnpm format`      | Prettier across `**/*.{ts,tsx,md}`               |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes |
| `pnpm db:migrate`  | Apply pending migrations                         |

Filter to a single workspace with `pnpm -F web <script>` or `pnpm -F @repo/api <script>`.

## Design decisions worth knowing

- **Single-statement dashboard query.** `form.getDashboardStats` is one SQL `WITH owned AS (...)` CTE that returns `forms`, totals, per-form counts, and the 90-day trend as JSON in a single round-trip. The pg pool is also pre-warmed with four sockets at boot, so the first burst of concurrent queries doesn't pay parallel TLS handshakes to Neon. Result: dashboard loads in ~250ms warm and stays under 300ms even when fired alongside other authed calls.
- **`Server-Timing` headers** are emitted from every authed tRPC procedure (`auth;dur=… inner;dur=…`). Visible in DevTools Network panel — useful for diagnosing whether a slow request was auth or query.
- **React Query staleTime caching** on dashboard / list / analytics hooks (30–60s) so in-app back-navigation paints instantly. Mutations always `invalidate()` on success, so stale data can't survive a real write.
- **Visitor lockout** is enforced in three places: the UI hides the form behind a `cf_submitted_<formId>` localStorage flag, the API service does a `(form_id, visitor_id)` lookup before insert, and a partial unique index on the same tuple wins races at the DB level.
- **Field type validation in the public form** does format checks for `EMAIL` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and `URL` (`new URL()`) — both block forward navigation and surface a sonner toast.
- **Code splitting.** Recharts widgets and the heaviest analytics components are loaded via `next/dynamic` per route. The submissions virtualised table mounts its detail modal only when a row is clicked.
- **Pricing tiers** are enforced server-side in `packages/services/form-submission/index.ts` (monthly submission caps) and `packages/trpc/server/trpc.ts` (`proAuthenticatedProcedure` for detailed analytics).

## Repository layout

```
.
├── apps
│   ├── api               # Express + tRPC, Better Auth mount, Scalar docs
│   └── web               # Next.js 16 studio
├── packages
│   ├── database          # Drizzle schema + models + migrations + pg pool
│   ├── services          # Business logic (form, form-field, form-submission, analytics)
│   ├── trpc              # Server router + shared client + procedures
│   ├── logger            # Winston wrapper
│   ├── eslint-config     # Shared ESLint config
│   └── typescript-config # Shared tsconfig presets
├── docker-compose.yml    # Local Postgres for development
├── setup.sh              # Hard-links root .env into every workspace
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Contributing

1. Branch off `main`.
2. Run `pnpm check-types && pnpm lint` before pushing.
3. Add a Drizzle migration (`pnpm db:generate`) for any schema change and commit both the SQL and the snapshot JSON.
4. Keep business logic in `packages/services`; the tRPC layer should stay thin.

## License

[MIT](./LICENSE) © Dittya Maity
