import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import compression from "compression";


import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import cookieParser from "cookie-parser";

import { serverRouter, createContext } from "@repo/trpc/server";
import { auth } from "@repo/trpc/server/auth";
import { toNodeHandler } from "better-auth/node";

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

app.use(
  ["/trpc/form.submitForm", "/trpc/feedback.submitFeedback"],
  publicWriteLimiter,
);

app.all("/api/auth/*splat", toNodeHandler(auth));

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

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use("/trpc", authGlobalLimiter);
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(uploadErrorHandler);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
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
