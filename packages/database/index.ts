import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./env";

/**
 * Shared connection pool.
 *
 * Locally this points at the docker-compose Postgres (see
 * `docker-compose.yml`, host port 5434 — 5432/5433 are taken by other
 * projects on the dev machine). Bring it up with `pnpm db:up`.
 *
 * The values below are sized for the worst case — a *managed remote*
 * Postgres, where every new connection costs a TLS handshake across a
 * WAN. They're deliberately kept for local Docker too: against loopback
 * they're simply cheap no-ops, so dev and prod share one code path
 * instead of diverging on connection behaviour.
 *
 * - `max: 10`     — managed tiers commonly cap active connections per
 *                   project around ~100. With a single API instance plus
 *                   Better Auth sharing this pool, 10 leaves headroom and
 *                   stops one runaway request from starving auth. Local
 *                   Postgres defaults to `max_connections = 100`, so 10
 *                   is comfortable there as well. If you raise it, check
 *                   the ceiling on whichever server you're pointed at or
 *                   you'll see "remaining connection slots" errors.
 * - `idleTimeoutMillis: 5min` — managed providers tend to close idle
 *                   sockets around the 5 minute mark, so we sit a hair
 *                   under it. The previous 30s value made every request
 *                   on a quiet endpoint pay a fresh handshake
 *                   (~250-700ms cross-region). Pairs with `keepAlive`.
 * - `keepAlive: true` — TCP keep-alive, so idle sockets aren't silently
 *                   dropped by an intermediary load balancer. Without it
 *                   we'd hit `read ETIMEDOUT` and reconnect on the next
 *                   request. Harmless against local Docker.
 * - `connectionTimeoutMillis: 10s` — fail fast if the database isn't
 *                   reachable instead of hanging the request forever.
 *                   This is the one you'll notice locally: if you forgot
 *                   `pnpm db:up`, you get a clear timeout in 10s rather
 *                   than a stuck request.
 *
 * Shared by the app queries and Better Auth's drizzle adapter.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 5 * 60_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

// Surface pool errors (e.g. server-side disconnects) instead of letting
// them bubble up as unhandled rejections.
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db pool] idle client error:", err.message);
});

// Warm a small set of connections at boot so the very first burst of
// concurrent queries (e.g. the dashboard fires 4 queries in parallel)
// doesn't pay 4 sequential TLS handshakes against a remote server. We
// don't try to fill the whole pool — just enough for the typical first
// request. Against local Docker this is near-instant and effectively
// free, so it's left on to keep dev and prod behaviour identical.
const WARM_CONNECTIONS = 4;
Promise.all(Array.from({ length: WARM_CONNECTIONS }, () => pool.connect()))
  .then((clients) => clients.forEach((c) => c.release()))
  .catch(() => {
    /* swallow — the next real query will surface the error normally. */
  });

export const db = drizzle(pool);
export * from "drizzle-orm";
export * from "./schema";
export default db;
