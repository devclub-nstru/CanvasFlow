import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  CLOUDINARY_FOLDER: z.string().optional().default("canvasflow"),

  UPLOAD_TMP_DIR: z.string().optional(),
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

export function isCloudinaryConfigured(): boolean {
  return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}
