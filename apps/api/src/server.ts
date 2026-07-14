import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import compression from "compression";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import cookieParser from "cookie-parser";

import { serverRouter, createContext } from "@repo/trpc/server";
import { auth } from "@repo/trpc/server/auth";
import { toNodeHandler } from "better-auth/node";

import { env } from "./env";

export const app = express();

// Trust the first proxy (Vercel/Render/Railway/Fly all sit a single hop in
// front of the node process). Required so express-rate-limit and any
// `req.ip` consumer reads the real client IP from `X-Forwarded-For`.
app.set("trust proxy", 1);

const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "CanvasFlow OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

// Origins that may hit the API with credentials. The first three are
// kept for local dev / legacy previews. Production origins are appended
// from `TRUSTED_ORIGINS` so we don't need a code change per environment.
const extraOrigins = (env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "https://canvas-flow-web.vercel.app",
  "https://canvas-flow-web-git-main-dittya-maitys-projects.vercel.app",
  ...extraOrigins,
];

// CORS must run before every handler, including the better-auth handler.
// Express v5 note: middleware registered with app.use() runs for ALL routes.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Idempotency-Key"],
    exposedHeaders: ["Set-Cookie", "Server-Timing"],
    // Cache preflight for 2 hours — eliminates the ~700ms OPTIONS round-trip
    // on every cross-origin request after the first.
    maxAge: 7200,
  }),
);

// gzip/brotli responses. Skip for already-compressed assets and small
// payloads (< 1KB) where compression overhead outweighs the saving.
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      // Respect the standard opt-out header
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(cookieParser());

/* ─── Rate limiting ────────────────────────────────────────────────────
 * Three tiers, each tuned for its threat model:
 *
 * 1. publicWriteLimiter   — narrow, IP-based. Guards public form-side
 *    endpoints (`recordView`, `recordFieldAnswer`, `submitForm`). These
 *    have no auth, so they're the easiest to abuse — a script could spam
 *    them and burn Neon storage/compute. 60 / minute per IP is generous
 *    enough for a classroom or office on shared NAT but tight enough to
 *    stop a single attacker.
 *
 * 2. authMutationLimiter — moderate, applies to authenticated tRPC calls.
 *    A signed-in user mashing buttons should still be allowed, but a
 *    stolen session token shouldn't be able to spam form creates.
 *
 * 3. authGlobalLimiter   — wide net on every /trpc request to catch
 *    pathological clients. Backstop, not primary defense.
 *
 * Stores are in-memory — fine for a single instance. If you ever scale
 * horizontally, swap in `rate-limit-redis` to share counts across nodes.
 * ────────────────────────────────────────────────────────────────────── */

const publicWriteLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 60,
  standardHeaders: "draft-7", // RateLimit-* headers
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and try again in a minute." },
});

const authGlobalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300, // generous for a logged-in tab making lots of small queries
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Key on session cookie if available, fall back to the proxy-aware IP
  // (ipKeyGenerator normalises IPv6 to a /64 prefix so we don't trivially
  // bucket every address separately).
  keyGenerator: (req) =>
    req.headers.cookie?.match(/better-auth\.session_token=([^;]+)/)?.[1] ??
    ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Request rate exceeded for this session." },
});

// Apply the public write limiter to the form-side write endpoints. tRPC's
// HTTP path includes the procedure name, so we can match on it.
app.use(
  ["/trpc/analytics.recordView", "/trpc/analytics.recordFieldAnswer", "/trpc/form.submitForm"],
  publicWriteLimiter,
);

// Better Auth handler must be mounted BEFORE express.json().
// Express v5 wildcard syntax: "*splat" (not "{*splat}" which is v4).
// Per the better-auth Express docs, do NOT use express.json() before this.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "200kb" })); // submission payload cap

app.get("/", (req, res) => {
  return res.json({ message: "CanvasFlow is up and running..." });
});

app.get("/health", (req, res) => {
  return res.json({ message: "CanvasFlow server is healthy", healthy: true });
});

// Diagnostic: confirm which social providers are active (safe — no secrets)
app.get("/api/auth/providers", (req, res) => {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push("github");
  return res.json({ providers, baseURL: process.env.BETTER_AUTH_URL || "not set" });
});

logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", async (req, res, next) => {
  try {
    const { apiReference } = await import("@scalar/express-api-reference");
    (apiReference({ url: "/openapi.json" }) as unknown as express.RequestHandler)(req, res, next);
  } catch (error) {
    next(error);
  }
});

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

// Global limiter sits in front of /trpc as a backstop. Per-procedure
// limits above already handle the abusable public ones.
app.use("/trpc", authGlobalLimiter);
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

export default app;
