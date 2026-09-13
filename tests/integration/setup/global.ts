import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Applied once for the whole run, not per file. The schema is the same for
 * every test; only the rows differ, and those are truncated between files. */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const TEST_PG_PORT = process.env.TEST_POSTGRES_PORT ?? "5435";
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://postgres:postgres@127.0.0.1:${TEST_PG_PORT}/canvasflow_test`;

async function waitForPostgres(pool: Pool, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await pool.query("select 1");
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /* Vitest prints "No test files found" alongside this, because a globalSetup
   * that throws aborts the run before collection. The tests are fine — read
   * this message, not that one. */
  throw new Error(
    [
      `The integration suite could not reach Postgres at ${DATABASE_URL}.`,
      "",
      "  With Docker:      pnpm test:up        (needs Docker Desktop running)",
      "  Without Docker:   brew services start postgresql@15 redis",
      "                    createdb canvasflow_test",
      "                    TEST_DATABASE_URL=postgresql://$(whoami)@127.0.0.1:5432/canvasflow_test \\",
      "                      TEST_REDIS_URL=redis://127.0.0.1:6379 pnpm test:integration:only",
      "",
      `Waited ${timeoutMs}ms. Last error: ${
        lastError instanceof Error ? lastError.message : lastError
      }`,
    ].join("\n"),
  );
}

export async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    await waitForPostgres(pool);
    await migrate(drizzle(pool), {
      migrationsFolder: path.join(root, "packages", "database", "drizzle"),
    });
  } finally {
    await pool.end();
  }
}
