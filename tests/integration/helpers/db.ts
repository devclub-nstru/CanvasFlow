import { db, closeDb, sql } from "@repo/database";

/* Isolation between test files.
 *
 * Not a transaction-per-test rollback: the services share one connection pool
 * and several paths take their own connection, so a rollback would isolate
 * some writes and not others — producing flakes rather than failures. Truncate
 * is slower and completely predictable, which is the right trade for a suite
 * whose whole point is trusting the result. */

let cachedTables: string[] | null = null;

async function publicTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;

  const rows = (await db.execute(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )) as unknown as { rows: Array<{ tablename: string }> };

  cachedTables = rows.rows
    .map((row) => row.tablename)
    /* Drizzle keeps its ledger in the `drizzle` schema, but guard anyway: a
     * truncated ledger would re-run every migration on the next boot. */
    .filter((name) => !name.startsWith("__drizzle"));

  return cachedTables;
}

/** Empties every table. Call in `beforeEach` of an integration file. */
export async function resetDatabase(): Promise<void> {
  const tables = await publicTables();
  if (tables.length === 0) return;

  const list = tables.map((name) => `"public"."${name}"`).join(", ");
  await db.execute(sql.raw(`truncate table ${list} restart identity cascade`));
}

/** Closes the pool so Vitest can exit instead of hanging on open handles. */
export async function teardownDatabase(): Promise<void> {
  cachedTables = null;
  await closeDb();
}

export { db };
