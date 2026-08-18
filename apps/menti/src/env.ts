import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4080"),
  NODE_ENV: z.string().default("development"),
  MONGO_URI: z.string(),
  BETTER_AUTH_URL: z.string(),
  REDIS_URI: z.string().optional(),
  TRUSTED_ORIGINS: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default env;
