import "dotenv/config";
import z from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),

  MENTI_PORT: z.coerce.number().int().positive().default(8080),

  MONGO_URI: z.string(),

  REDIS_URL: z.string().optional(),
  REDIS_PREFIX: z.string().default("cf"),

  JWT_SECRET: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),

  WEB_URL: z.string().optional(),
  MENTI_TRUSTED_ORIGINS: z.string().optional(),

  MENTI_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),

  MENTI_MAX_PARTICIPANTS_PER_SESSION: z.coerce
    .number()
    .int()
    .positive()
    .default(2000),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_DOMAIN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
});

function withoutBlanks(source) {
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

function createEnv(source) {
  const clean = withoutBlanks(source);

  const normalised = {
    ...clean,
    /* Back-compat: the standalone service used PORT and REDIS_URI. */
    MENTI_PORT: clean.MENTI_PORT ?? clean.MENTI_API_PORT,
    REDIS_URL: clean.REDIS_URL || clean.REDIS_URI,
  };

  const parsed = envSchema.safeParse(normalised);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid menti environment:\n${problems}\n\n` +
        `Values come from the repository root .env (see .env.example). Note that ` +
        `MENTI_PORT — not PORT — selects this service's port, because PORT is ` +
        `already claimed by apps/api in the same file.`,
    );
  }

  return parsed.data;
}

const env = createEnv(process.env);

export const isProduction = env.NODE_ENV === "production";

export const redisKey = (...parts) => [env.REDIS_PREFIX, "menti", ...parts].join(":");

export const sharedRedisKey = (...parts) => [env.REDIS_PREFIX, ...parts].join(":");

export default env;
