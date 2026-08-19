import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().default(() => process.env.BETTER_AUTH_SECRET || "default-secret-key-123456"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  if (env.SKIP_ENV_VALIDATION) {
    return {
      JWT_SECRET: "",
    };
  }
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
