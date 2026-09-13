import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  LOGGER_LEVEL: z.enum(["error", "debug", "info"]).optional(),
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
