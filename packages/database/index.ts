import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./env";

/**
 * Shared connection pool.
 *
 * Why explicit values (instead of node-postgres defaults):
 * - `max: 10`     — Neon's free tier caps total active connections per
 *                   project at ~100. With a single API instance plus
 *                   Better Auth's own pool, 10 leaves plenty of headroom
 *                   and prevents one runaway request from starving auth.
 *                   Raise this once you're on a paid Neon plan or you'll
 *                   see "remaining connection slots" errors from Postgres.
 * - `idleTimeoutMillis: 5min` — Neon's TCP layer closes idle sockets
 *                   after ~5 minutes anyway, so we keep the pool a hair
 *                   under that. The previous 30s value was making every
 *                   request on a quiet endpoint pay the full TLS+
 *                   handshake cost (~250–700ms to us-east). Pairs with
 *                   `keepAlive: true` so the sockets we hold stay live.
 * - `keepAlive: true` — turns on TCP keep-alive so idle sockets aren't
 *                   silently dropped by Neon's load balancer; without
 *                   this we'd hit `read ETIMEDOUT` and reconnect on the
 *                   next request, eating ~300ms.
 * - `connectionTimeoutMillis: 10s` — fail fast if the database isn't
 *                                    reachable instead of hanging the
 *                                    request indefinitely.
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
// doesn't pay 4 sequential TLS handshakes to Neon. We don't try to fill
// the whole pool — just enough for the typical first request.
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
