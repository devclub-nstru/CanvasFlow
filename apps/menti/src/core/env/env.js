import "dotenv/config";
import z from "zod";

/* This app now shares one `.env` with the rest of the monorepo (setup.sh
 * hard-links the root file into every workspace), so variable names have to be
 * unambiguous across processes:
 *
 *   - PORT belongs to apps/api. Menti reads MENTI_PORT so the two cannot
 *     collide when both read the same file.
 *   - REDIS_URL is the monorepo-wide name; REDIS_URI is still accepted so an
 *     existing standalone deployment keeps booting after the move.
 *   - JWT_SECRET is the same secret apps/api signs sessions with. Menti only
 *     ever verifies those tokens, so the two MUST agree — that is the whole
 *     reason a presenter authenticated by the web app is recognised here.
 */

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),

  MENTI_PORT: z.coerce.number().int().positive().default(8080),

  MONGO_URI: z.string(),

  REDIS_URL: z.string().optional(),
  REDIS_PREFIX: z.string().default("cf"),

  /* Verified, never minted, here. Resolution and the production hard-fail live
   * in ./secret.js so there is exactly one rule in the repo. */
  JWT_SECRET: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),

  WEB_URL: z.string().optional(),
  MENTI_TRUSTED_ORIGINS: z.string().optional(),

  MENTI_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_DOMAIN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
});

function createEnv(source) {
  const normalised = {
    ...source,
    /* Back-compat: the standalone service used PORT and REDIS_URI. */
    MENTI_PORT: source.MENTI_PORT ?? source.MENTI_API_PORT,
    REDIS_URL: source.REDIS_URL || source.REDIS_URI,
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

/* Namespaces every Redis key this service writes, so it can share one Redis
 * instance with the API's cache, rate limiter, and BullMQ queues without any
 * chance of a key collision. */
export const redisKey = (...parts) => [env.REDIS_PREFIX, "menti", ...parts].join(":");

export default env;
