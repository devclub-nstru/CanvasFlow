/* Runs before any test module — and, critically, before `@repo/database` is
 * imported, because that module builds its pg Pool and opens four warm
 * connections the moment it loads. If DATABASE_URL is not already pointing at
 * the throwaway database by then, the suite would truncate a real one.
 *
 * Everything is overridable so the same suite can run against the compose
 * services, a local Postgres, or CI service containers. */

const TEST_PG_PORT = process.env.TEST_POSTGRES_PORT ?? "5435";
const TEST_REDIS_PORT = process.env.TEST_REDIS_PORT ?? "6380";
const TEST_MONGO_PORT = process.env.TEST_MONGO_PORT ?? "27018";

/* SKIP_ENV_VALIDATION is deliberately NOT set here, unlike in the unit setup.
 * packages/database/env.ts short-circuits to `DATABASE_URL: ""` when it sees
 * that flag — which is right when the database is mocked and catastrophic
 * here: pg falls back to its own defaults and quietly connects to whatever
 * local Postgres it can find instead of the throwaway container. */
const overrides: Record<string, string> = {
  NODE_ENV: "test",

  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    `postgresql://postgres:postgres@127.0.0.1:${TEST_PG_PORT}/canvasflow_test`,

  REDIS_URL: process.env.TEST_REDIS_URL ?? `redis://127.0.0.1:${TEST_REDIS_PORT}`,

  /* A prefix of its own, so a stray key can never be mistaken for one written
   * by a running dev stack sharing the same Redis. */
  REDIS_PREFIX: "cftest",

  MONGO_URI:
    process.env.TEST_MONGO_URI ?? `mongodb://127.0.0.1:${TEST_MONGO_PORT}/canvasflow_test`,

  JWT_SECRET: "integration-suite-secret-that-is-long-enough-to-pass-checks",
  WEB_URL: "https://app.canvasflow.test",
  TRUSTED_ORIGINS: "https://alt.canvasflow.test",
  GOOGLE_CLIENT_ID: "integration-google-id",
  GOOGLE_CLIENT_SECRET: "integration-google-secret",

  /* Smaller than production so a pool exhaustion bug surfaces as a failure
   * rather than as a slow suite. */
  DB_POOL_MAX: "10",
};

delete process.env.SKIP_ENV_VALIDATION;

for (const [key, value] of Object.entries(overrides)) {
  process.env[key] = value;
}

/* A last line of defence. Every table is truncated between files, so pointing
 * this suite at anything but a disposable database has to be impossible rather
 * than merely unlikely. */
const url = process.env.DATABASE_URL ?? "";
if (!/(test|_test|canvasflow_test)/i.test(url)) {
  throw new Error(
    `The integration suite refuses to run against "${url}" — the database name ` +
      `must contain "test", because every table is truncated between files.`,
  );
}
