import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().default(() => process.env.BETTER_AUTH_SECRET || "default-secret-key-123456"),
});

function withoutBlanks(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...source };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && value.trim() === "") delete out[key];
  }
  return out;
}

function createEnv(env: NodeJS.ProcessEnv) {
  if (env.SKIP_ENV_VALIDATION) {
    return {
      JWT_SECRET: "",
    };
  }
  const safeParseResult = envSchema.safeParse(withoutBlanks(env));
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
