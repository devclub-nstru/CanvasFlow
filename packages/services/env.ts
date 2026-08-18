import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().describe("Secret key for JWT tokens"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  // See packages/database/env.ts — skips validation, never discards real values.
  if (env.SKIP_ENV_VALIDATION) {
    return {
      JWT_SECRET: env.JWT_SECRET ?? "",
    };
  }
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
