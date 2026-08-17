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
  if (env.SKIP_ENV_VALIDATION) {
    return {
      DATABASE_URL: "",
      DB_POOL_MAX: 25,
      DB_STATEMENT_TIMEOUT_MS: 10000,
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
