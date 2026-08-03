import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import db from "@repo/database";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "@repo/database/models/auth";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
if (googleClientId && googleClientSecret) {
  socialProviders.google = { clientId: googleClientId, clientSecret: googleClientSecret };
}
if (githubClientId && githubClientSecret) {
  socialProviders.github = { clientId: githubClientId, clientSecret: githubClientSecret };
}

const extraTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

// Redis session cache
const sessionCache = (() => {
  if (!isRedisConfigured()) return undefined;

  return {
    get: async (key: string): Promise<string | null> => {
      try {
        const client = await redisReady();
        if (!client) return null;
        return await client.get(redisKey("auth", key));
      } catch {
        return null;
      }
    },

    set: async (key: string, value: string, ttl?: number): Promise<void> => {
      try {
        const client = await redisReady();
        if (!client) return;

        if (ttl && ttl > 0) await client.set(redisKey("auth", key), value, "EX", ttl);
        else await client.set(redisKey("auth", key), value, "EX", 86_400);
      } catch {}
    },

    delete: async (key: string): Promise<void> => {
      try {
        const client = await redisReady();
        if (!client) return;
        await client.del(redisKey("auth", key));
      } catch {}
    },
  };
})();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: usersTable,
      session: sessionsTable,
      account: accountsTable,
      verification: verificationsTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  ...(sessionCache ? { secondaryStorage: sessionCache } : {}),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    storeSessionInDatabase: true,
  },
  socialProviders,
  trustedOrigins: [
    "http://localhost:3000",
    "https://canvas-flow-web.vercel.app",
    "https://canvas-flow-web-git-main-dittya-maitys-projects.vercel.app",
    ...extraTrustedOrigins,
  ],
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  },
});

export type Auth = ReturnType<typeof betterAuth>;
export type Session = Auth["$Infer"]["Session"];
