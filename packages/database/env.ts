import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().describe("DB URL"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(500).optional().default(25),
  DB_STATEMENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .optional()
    .default(10_000),
});

function createEnv(env: NodeJS.ProcessEnv) {
  // Build-time escape hatch: `next build` and `tsc` must run without prod
  // secrets. It skips *validation* only — real values still win when present,
  // so a stray SKIP_ENV_VALIDATION in a runtime .env cannot blank the pool's
  // connection string and silently repoint it at pg's localhost:5432 defaults.
  if (env.SKIP_ENV_VALIDATION) {
    return {
      DATABASE_URL: env.DATABASE_URL ?? "",
      DB_POOL_MAX: Number(env.DB_POOL_MAX) || 25,
      DB_STATEMENT_TIMEOUT_MS: Number(env.DB_STATEMENT_TIMEOUT_MS) || 10_000,
    };
  }
  const safeParseResult = envSchema.safeParse(env);

  if (!safeParseResult.success) {
    const problems = safeParseResult.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid database environment:\n${problems}\n\n` +
        `DATABASE_URL is read from the environment, which in development comes from a ` +
        `.env file loaded by dotenv relative to the running app's directory. If this fired ` +
        `on startup, that app most likely has no .env — see .env.example, and note that ` +
        `apps/worker reads the repository root's .env explicitly.`,
    );
  }

  return safeParseResult.data;
}

export const env = createEnv(process.env);
