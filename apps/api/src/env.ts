import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.string().default("development"),
  BASE_URL: z.string().default("http://localhost:8000"),
  TRUSTED_ORIGINS: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_TMP_DIR: z.string().optional(),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(1_024).optional().default(10),
  UPLOAD_MAX_MB_IMAGE: z.coerce.number().positive().max(1_024).optional().default(10),
  UPLOAD_MAX_MB_VIDEO: z.coerce.number().positive().max(4_096).optional().default(100),
  UPLOAD_MAX_MB_RAW: z.coerce.number().positive().max(1_024).optional().default(10),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(500).optional().default(25),
  CLUSTER_WORKERS: z.coerce.number().int().min(0).max(64).optional().default(0),

  /* Metrics are served on their own port, never on PORT — see
   * packages/observability/server.ts. Nothing should proxy this one. */
  METRICS_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  METRICS_PORT: z.coerce.number().int().min(1).max(65_535).optional().default(9464),
  RATE_LIMIT_PUBLIC_WRITE_MAX: z.coerce.number().int().min(1).optional().default(60),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).optional().default(300),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().min(1).optional().default(30),
  RATE_LIMIT_LOGIN_IP_MAX: z.coerce.number().int().min(1).optional().default(12),
  RATE_LIMIT_LOGIN_ACCOUNT_MAX: z.coerce.number().int().min(1).optional().default(8),
  RATE_LIMIT_AUTH_ROUTE_MAX: z.coerce.number().int().min(1).optional().default(240),
  RATE_LIMIT_EMAIL_IP_MAX: z.coerce.number().int().min(1).optional().default(5),
  RATE_LIMIT_EMAIL_ACCOUNT_MAX: z.coerce.number().int().min(1).optional().default(3),
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
