/* Runs before any test module is imported.
 *
 * Several modules validate environment on import, and `@repo/database` builds a
 * pg Pool and opens warm connections the moment it is loaded. Tests that touch
 * those paths mock the module; everything else relies on the values below being
 * present so that import-time validation passes without a real deployment.
 *
 * DATABASE_URL intentionally points at a closed port: if a test reaches real
 * SQL it should fail loudly rather than talk to a developer's local database. */

const defaults: Record<string, string> = {
  NODE_ENV: "test",
  SKIP_ENV_VALIDATION: "true",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5999/unit-tests",
  REDIS_URL: "",
  JWT_SECRET: "unit-test-secret-that-is-long-enough-to-pass-checks",
  WEB_URL: "https://app.canvasflow.test",
  API_URL: "https://api.canvasflow.test",
  TRUSTED_ORIGINS: "https://alt.canvasflow.test",
  GOOGLE_CLIENT_ID: "unit-test-google-id",
  GOOGLE_CLIENT_SECRET: "unit-test-google-secret",
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
