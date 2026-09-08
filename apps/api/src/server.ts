import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import compression from "compression";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import cookieParser from "cookie-parser";

import { serverRouter, createContext } from "@repo/trpc/server";
import { authRouter } from "@repo/trpc/server/auth";


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

/* Every procedure is reachable twice: as `/trpc/<router>.<procedure>` and, via
 * trpc-to-openapi, as the REST path declared in its `openapi.path` meta. A
 * limiter mounted on only one spelling is a limiter with a documented bypass,
 * so both are listed. Keep this in step with the `openapi.path` values in
 * packages/trpc/server/routes/*: form.submitForm -> /forms/submitForm and
 * feedback.submitFeedback -> /feedback/submit, both under the /api base. */
const PUBLIC_WRITE_PATHS = [
  "/trpc/form.submitForm",
  "/trpc/feedback.submitFeedback",
  "/api/forms/submitForm",
  "/api/feedback/submit",
];

app.use(PUBLIC_WRITE_PATHS, publicWriteLimiter);

/* ── Credential endpoint protection ────────────────────────────────────────
 *
 * These used to sit in front of nothing: the auth router was mounted here with
 * no limiter above it, and the two limiters that existed were scoped to
 * `/trpc` paths. Sign-in was completely unmetered, which makes it a password
 * guessing oracle.
 *
 * Three layers, because each defeats a different attack:
 *
 *   - per-IP on the credential paths, bounding one machine's guess rate;
 *   - per-account on the same paths, so distributing the attack across a
 *     botnet does not raise the guess rate against a single victim — this is
 *     the one that actually protects a targeted account;
 *   - a loose per-IP ceiling on the rest of the router, which is mostly
 *     `get-session` and the OAuth dance, so those cannot be used to hammer
 *     the process either.
 *
 * `identify: "ip"` matters here. The default identity prefers a caller-supplied
 * cookie or bearer token, and an attacker rotating either would get a fresh
 * budget on every request.
 */
const CREDENTIAL_PATHS = [
  "/api/auth/signin/email",
  "/api/auth/sign-in/email",
  "/api/auth/signup/email",
  "/api/auth/sign-up/email",
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
  /* Keyed on the account under attack rather than the attacker's address. The
   * value is hashed by the limiter, so no address reaches Redis. */
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

/* The account limiter reads req.body, so the body has to be parsed before it
 * runs. body-parser marks the request and skips re-parsing, so the
 * express.json() inside authRouter remains harmless. 16kb is generous for a
 * credential payload. */
app.use(CREDENTIAL_PATHS, express.json({ limit: "16kb" }), loginIpLimiter, loginAccountLimiter);
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

/* Ahead of *both* routers. This used to be mounted on "/trpc" only, and after
 * the "/api" middleware at that, so every limit could be sidestepped simply by
 * calling the documented REST path instead of the tRPC one.
 *
 * "/api/auth" is nominally matched here too, but the auth router above has
 * already responded to those requests by this point, so they are not charged
 * twice — they have their own dedicated limiters. */
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
