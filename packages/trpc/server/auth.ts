import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import db from "@repo/database";
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "@repo/database/models/auth";

// Only register a social provider when BOTH its client id and secret are
// present as real values. Falling back to placeholder strings causes a 500
// when better-auth tries to initiate the OAuth flow.
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

// Additional trusted origins from env (comma-separated). Lets us add
// production / staging hosts without code edits.
//   TRUSTED_ORIGINS=https://canvasflow.dittya.dev
const extraTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Cookie domain for the subdomain split (web on `canvasflow.…`, api on
// `api.canvasflow.…`). Setting this to `.canvasflow.dittya.dev` lets the
// session cookie set by `/api/auth/*` be read by the web app. Omit in
// dev — leaving it unset scopes the cookie to the request host, which
// is what we want on `localhost`.
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

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
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
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
