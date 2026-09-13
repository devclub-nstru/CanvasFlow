import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/* The migrations, applied to a database of their own.
 *
 * Every other file in this suite runs against a database globalSetup already
 * migrated, which proves the migrations work on *that* machine's history and
 * nothing more. These start from nothing.
 *
 * The prompt for it: commit 7902c33 dropped form_field_views. A destructive
 * migration that fails halfway, or one that cannot be applied twice, is only
 * discovered during a deploy — the least convenient moment there is. */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MIGRATIONS = path.join(root, "packages", "database", "drizzle");

const SCRATCH_DB = "canvasflow_migrations_test";

/** The suite's own URL, repointed at another database on the same server. */
function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function withAdmin<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: urlFor("postgres"), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function recreateScratchDatabase(): Promise<void> {
  await withAdmin(async (pool) => {
    await pool.query(`drop database if exists ${SCRATCH_DB} with (force)`);
    await pool.query(`create database ${SCRATCH_DB}`);
  });
}

async function applyMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: urlFor(SCRATCH_DB), max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
  } finally {
    await pool.end();
  }
}

async function queryScratch<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = new Pool({ connectionString: urlFor(SCRATCH_DB), max: 1 });
  try {
    const result = await pool.query(sql, params as never[]);
    return result.rows as T[];
  } finally {
    await pool.end();
  }
}

const tableNames = async (): Promise<string[]> => {
  const rows = await queryScratch<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  return rows.map((row) => row.tablename);
};

beforeAll(async () => {
  await recreateScratchDatabase();
}, 60_000);

afterAll(async () => {
  await withAdmin((pool) => pool.query(`drop database if exists ${SCRATCH_DB} with (force)`));
});

describe("applying every migration to an empty database", () => {
  it("succeeds", async () => {
    await expect(applyMigrations()).resolves.toBeUndefined();
  });

  it("creates the tables the application expects", async () => {
    const tables = await tableNames();

    for (const table of [
      "users",
      "sessions",
      /* Singular, unlike the rest — the better-auth heritage shows here. */
      "account",
      "verification",
      "pending_signups",
      "forms",
      "form_fields",
      "form_segments",
      "form_logic_rules",
      "form_logic_conditions",
      "form_submissions",
      "form_uploads",
      "form_drafts",
      "form_collaborators",
      "feedback",
    ]) {
      expect(tables, `${table} is missing`).toContain(table);
    }
  });

  it("leaves behind no table a later migration was supposed to drop", async () => {
    /* Retired in 7902c33. A fresh database must not resurrect it. */
    expect(await tableNames()).not.toContain("form_field_views");
  });

  it("records what it applied in the drizzle ledger", async () => {
    const rows = await queryScratch<{ count: string }>(
      `select count(*)::text as count from drizzle.__drizzle_migrations`,
    );
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
  });
});

describe("applying them a second time", () => {
  it("is a no-op rather than an error", async () => {
    await expect(applyMigrations()).resolves.toBeUndefined();
  });

  it("adds no duplicate tables", async () => {
    const before = await tableNames();
    await applyMigrations();
    expect(await tableNames()).toEqual(before);
  });

  it("adds no duplicate ledger entries", async () => {
    const countEntries = async () =>
      Number(
        (
          await queryScratch<{ count: string }>(
            `select count(*)::text as count from drizzle.__drizzle_migrations`,
          )
        )[0]?.count ?? 0,
      );

    const before = await countEntries();
    await applyMigrations();
    expect(await countEntries()).toBe(before);
  });
});

describe("the constraints the application leans on", () => {
  /** Indexes on a table, by name. */
  async function indexesOn(table: string): Promise<string[]> {
    const rows = await queryScratch<{ indexdef: string }>(
      `select indexdef from pg_indexes where schemaname = 'public' and tablename = $1`,
      [table],
    );
    return rows.map((row) => row.indexdef);
  }

  it("makes a form slug unique across the whole table", async () => {
    const defs = await indexesOn("forms");
    expect(defs.some((def) => /unique/i.test(def) && /\(slug\)/.test(def))).toBe(true);
  });

  it("makes a question's index unique within its form", async () => {
    const defs = await indexesOn("form_fields");
    expect(
      defs.some((def) => /unique/i.test(def) && /form_id/.test(def) && /index/.test(def)),
      "unique(form_id, index) is what stops two questions sharing a position",
    ).toBe(true);
  });

  it("makes an idempotency key unique per form, but only when present", async () => {
    const defs = await indexesOn("form_submissions");
    const partial = defs.find((def) => /idempotency/i.test(def));

    expect(partial).toBeDefined();
    expect(partial, "a partial index, so unkeyed submissions are exempt").toMatch(/where/i);
  });

  it("allows only one collaborator row per person per form", async () => {
    const defs = await indexesOn("form_collaborators");
    expect(defs.some((def) => /unique/i.test(def) && /form_id/.test(def) && /user_id/.test(def))).toBe(
      true,
    );
  });

  it("cascades a deleted form to its questions", async () => {
    const rows = await queryScratch<{ delete_rule: string }>(
      `select rc.delete_rule
         from information_schema.referential_constraints rc
         join information_schema.table_constraints tc
           on tc.constraint_name = rc.constraint_name
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = rc.constraint_name
        where tc.table_name = 'form_fields' and kcu.column_name = 'form_id'`,
    );
    expect(rows[0]?.delete_rule).toBe("CASCADE");
  });

  it("releases a question when its segment goes, rather than deleting it", async () => {
    const rows = await queryScratch<{ delete_rule: string }>(
      `select rc.delete_rule
         from information_schema.referential_constraints rc
         join information_schema.table_constraints tc
           on tc.constraint_name = rc.constraint_name
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = rc.constraint_name
        where tc.table_name = 'form_fields' and kcu.column_name = 'segment_id'`,
    );
    expect(rows[0]?.delete_rule).toBe("SET NULL");
  });
});
