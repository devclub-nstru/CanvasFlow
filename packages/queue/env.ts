import { z } from "zod";

const numeric = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional().default(fallback);

const envSchema = z.object({
  UPLOAD_WORKER_CONCURRENCY: numeric(8, 1, 200),

  ANALYTICS_WORKER_CONCURRENCY: numeric(4, 1, 64),

  ANALYTICS_BATCH_MS: numeric(250, 0, 5_000),

  ANALYTICS_BATCH_MAX: numeric(500, 1, 5_000),

  ANALYTICS_INSERT_CHUNK: numeric(500, 1, 5_000),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
