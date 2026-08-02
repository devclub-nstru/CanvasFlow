import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,

  max: env.DB_POOL_MAX,

  idleTimeoutMillis: 5 * 60_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,

  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  query_timeout: env.DB_STATEMENT_TIMEOUT_MS,
});

pool.on("error", (err) => {
  console.error("[db pool] idle client error:", err.message);
});

const WARM_CONNECTIONS = 4;
Promise.all(Array.from({ length: WARM_CONNECTIONS }, () => pool.connect()))
  .then((clients) => clients.forEach((c) => c.release()))
  .catch(() => {});

export const db = drizzle(pool);

export async function closeDb(): Promise<void> {
  try {
    await pool.end();
  } catch {
    /* Already closed, or never opened. Shutdown is not a place to throw. */
  }
}

export * from "drizzle-orm";
export * from "./schema";
export default db;
