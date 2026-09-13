import { z } from "zod";

const numeric = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional().default(fallback);

const envSchema = z.object({
  UPLOAD_WORKER_CONCURRENCY: numeric(8, 1, 200),
});

function withoutBlanks(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...source };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && value.trim() === "") delete out[key];
  }
  return out;
}

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(withoutBlanks(env));
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
