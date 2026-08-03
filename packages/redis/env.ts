import { z } from "zod";

const envSchema = z.object({
  REDIS_URL: z.string().optional(),
  REDIS_PREFIX: z.string().default("cf"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
