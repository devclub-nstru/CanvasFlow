import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import compression from "compression";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import cookieParser from "cookie-parser";

import { serverRouter, createContext } from "@repo/trpc/server";
import { authRouter } from "@repo/trpc/server/auth";
import { db, sql } from "@repo/database";
import { isRedisConfigured, redisReady } from "@repo/redis";
import { metricsMiddleware } from "@repo/observability";

import { env } from "./env";
import { uploadRouter, uploadErrorHandler } from "./routes/upload";
import { leakyBucketRateLimiter } from "./lib/rate-limiter";

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

const extraOrigins = (env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "https://canvas-flow-web.vercel.app",
  "https://devclubxnst.online",
  "https://canvas-flow-web-git-main-dittya-maitys-projects.vercel.app",
  ...extraOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Idempotency-Key",
      "X-Upload-Token",
    ],
    exposedHeaders: ["Set-Cookie", "Server-Timing"],
    maxAge: 7200,
  }),
);

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(cookieParser());

/* Before the rate limiters on purpose. A 429 is a response a user experiences,
 * and a limiter that has started rejecting traffic is exactly the moment the
 * graph needs to show it. Health probes are excluded so that Docker's 10s
 * healthcheck does not dominate the request histogram. */
app.use(metricsMiddleware(["/health", "/ready"]));

const publicWriteLimiter = leakyBucketRateLimiter({
  bucketName: "public-write",
  max: env.RATE_LIMIT_PUBLIC_WRITE_MAX,
  windowMs: 60_000,
  message: { error: "Too many requests — slow down and try again in a minute." },
});

const authGlobalLimiter = leakyBucketRateLimiter({
  bucketName: "auth-global",
  max: env.RATE_LIMIT_AUTH_MAX,
  windowMs: 60_000,
  message: { error: "Request rate exceeded for this session." },
});

const PUBLIC_WRITE_PATHS = [
  "/trpc/form.submitForm",
  "/trpc/feedback.submitFeedback",
  "/api/forms/submitForm",
  "/api/feedback/submit",
];

app.use(PUBLIC_WRITE_PATHS, publicWriteLimiter);

const CREDENTIAL_PATHS = [
  "/api/auth/signin/email",
  "/api/auth/sign-in/email",
  "/api/auth/signup/email",
  "/api/auth/sign-up/email",
  "/api/auth/signup/verify",
  "/api/auth/sign-up/verify",
];

const loginIpLimiter = leakyBucketRateLimiter({
  bucketName: "auth-login-ip",
  max: env.RATE_LIMIT_LOGIN_IP_MAX,
  windowMs: 60_000,
  identify: "ip",
  message: { error: "Too many sign-in attempts. Wait a minute and try again." },
});

const loginAccountLimiter = leakyBucketRateLimiter({
  bucketName: "auth-login-account",
  max: env.RATE_LIMIT_LOGIN_ACCOUNT_MAX,
  windowMs: 60_000,
  identify: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof email !== "string") return null;
    const normalized = email.trim().toLowerCase();
    return normalized ? `account:${normalized}` : null;
  },
  message: { error: "Too many sign-in attempts for this account. Try again shortly." },
});

const authRouteLimiter = leakyBucketRateLimiter({
  bucketName: "auth-route-ip",
  max: env.RATE_LIMIT_AUTH_ROUTE_MAX,
  windowMs: 60_000,
  identify: "ip",
  message: { error: "Too many requests — slow down and try again in a minute." },
});

app.use(CREDENTIAL_PATHS, express.json({ limit: "16kb" }), loginIpLimiter, loginAccountLimiter);

/* Every endpoint that sends mail. Each request costs money and can be aimed at
 * an inbox the caller does not own, which is why these are limited harder than
 * the credential endpoints.
 *
 * Signup is on this list because it now mails a confirmation code, and resend
 * exists only to send another one. Verify is deliberately absent — it sends
 * nothing, and it already caps wrong guesses per pending signup; limiting it
 * per address here would let one attacker lock a real person out of finishing
 * their own sign-up. It is still covered by the credential limiter below. */
const EMAIL_SENDING_PATHS = [
  "/api/auth/forgot-password",
  "/api/auth/signup/email",
  "/api/auth/sign-up/email",
  "/api/auth/signup/resend",
  "/api/auth/sign-up/resend",
];

const emailIpLimiter = leakyBucketRateLimiter({
  bucketName: "auth-email-ip",
  max: env.RATE_LIMIT_EMAIL_IP_MAX,
  windowMs: 60_000,
  identify: "ip",
  message: { error: "Too many requests. Wait a minute and try again." },
});

const emailAccountLimiter = leakyBucketRateLimiter({
  bucketName: "auth-email-account",
  max: env.RATE_LIMIT_EMAIL_ACCOUNT_MAX,
  windowMs: 60_000,
  identify: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof email !== "string") return null;
    const normalized = email.trim().toLowerCase();
    return normalized ? `email:${normalized}` : null;
  },
  message: { error: "Too many requests for that address. Try again shortly." },
});

const resetRedeemLimiter = leakyBucketRateLimiter({
  bucketName: "auth-reset-redeem",
  max: env.RATE_LIMIT_LOGIN_IP_MAX,
  windowMs: 60_000,
  identify: "ip",
  message: { error: "Too many attempts. Wait a minute and try again." },
});

app.use(EMAIL_SENDING_PATHS, express.json({ limit: "16kb" }), emailIpLimiter, emailAccountLimiter);
app.use("/api/auth/reset-password", express.json({ limit: "16kb" }), resetRedeemLimiter);

app.use("/api/auth", authRouteLimiter);

app.use("/api/auth", authRouter);

app.use(uploadRouter);

app.use(express.json({ limit: "200kb" }));

app.get("/", (req, res) => {
  return res.json({ message: "CanvasFlow is up and running..." });
});

app.get("/health", (req, res) => {
  return res.json({ message: "CanvasFlow server is healthy", healthy: true });
});

const READY_CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

type CheckResult = { status: "ok" | "skipped" | "error"; latencyMs: number; error?: string };

async function timedCheck(run: () => Promise<void>): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    await withTimeout(run(), READY_CHECK_TIMEOUT_MS);
    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

app.get("/ready", async (req, res) => {
  const [postgres, redis] = await Promise.all([
    timedCheck(async () => {
      await db.execute(sql`select 1`);
    }),

    isRedisConfigured()
      ? timedCheck(async () => {
          const connection = await redisReady(READY_CHECK_TIMEOUT_MS);
          if (!connection) throw new Error("redis connection not ready");
          await connection.ping();
        })
      : Promise.resolve<CheckResult>({ status: "skipped", latencyMs: 0 }),
  ]);

  const checks = { postgres, redis };
  const ready = Object.values(checks).every((check) => check.status !== "error");

  if (!ready) {
    const failed = Object.entries(checks)
      .filter(([, check]) => check.status === "error")
      .map(([name, check]) => `${name}: ${check.error}`)
      .join("; ");

    logger.error(`[api] readiness check failed — ${failed}`);
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(ready ? 200 : 503).json({ ready, checks });
});

app.get("/api/auth/providers", (req, res) => {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push("github");
  return res.json({ providers });
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

app.use(["/trpc", "/api"], authGlobalLimiter);

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(uploadErrorHandler);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("[api] unhandled error", {
      method: req.method,
      path: req.path,
      err: err instanceof Error ? err.stack : err,
    });

    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
