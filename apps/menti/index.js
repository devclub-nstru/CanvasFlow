import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createServer } from "node:http";
import path from "node:path";

import env, { isProduction } from "./src/core/env/env.js";
import { assertAuthSecret } from "./src/core/env/secret.js";
import { logger } from "./src/core/logger/logger.js";
import { connectMongo, closeMongo } from "./src/core/database/connect.js";
import { closeRedis } from "./src/core/database/redis.js";
import { initRealtimeServer, closeRealtimeServer } from "./realtime/server.js";
import { flushPresence } from "./realtime/presence.js";
import { quizTimerManager } from "./src/modules/quiz/quizTimerManager.js";

import presentationRoutes from "./src/modules/presentation/presentation.routes.js";
import sessionRoutes from "./src/modules/session/session.routes.js";
import healthRoutes from "./src/modules/health/health.routes.js";

/* Menti verifies the session tokens apps/api mints. Without a shared secret it
 * cannot authenticate a single presenter, so fail at boot rather than at the
 * first connection. */
assertAuthSecret();

const app = express();
const server = createServer(app);

/* Behind the same single proxy hop as the rest of the stack, so req.ip is the
 * real client rather than the proxy. */
app.set("trust proxy", 1);

const allowedOrigins = [
  env.WEB_URL,
  ...(env.MENTI_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:3001"]),
].filter(Boolean);

app.use(
  cors({
    /* Was `origin: true`, which reflects *any* origin. Combined with
     * `credentials: true` that let any site on the internet make authenticated
     * requests with the user's cf_jwt cookie attached. */
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "200kb" }));

/* `dev` formatting on every request is a synchronous write per request. Keep it
 * for local work, drop it in production where the proxy already has an access
 * log. */
if (!isProduction) app.use(morgan("dev"));

// Static folder for PowerPoint uploads & rendered slides
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/health", healthRoutes);
app.use("/api/presentations", presentationRoutes);
app.use("/api/sessions", sessionRoutes);

app.use((err, req, res, _next) => {
  logger.error("unhandled error", req.method, req.path, err?.message);
  if (res.headersSent) return res.end();
  return res.status(500).json({ error: "Internal server error" });
});

async function main() {
  const [, error] = await connectMongo(env.MONGO_URI);
  if (error) {
    logger.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
  logger.info("MongoDB connected");

  /* Realtime must come up *after* Mongo: the connection handler reads the
   * session on the very first socket, and a client that connected during the
   * gap used to get "Session not found" and disconnect. */
  await initRealtimeServer(server);

  await quizTimerManager.initRestartRecovery();

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" || err.code === "EACCES") {
      logger.error(`cannot bind port ${env.MENTI_PORT}: ${err.code}. Exiting.`);
      process.exit(1);
    }
    logger.error("http server error:", err.message);
  });

  server.listen(env.MENTI_PORT, () => {
    logger.info(`menti listening on ${env.MENTI_PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received — draining connections...`);

    const forceExit = setTimeout(() => {
      logger.error("shutdown timed out — exiting");
      process.exit(1);
    }, 25_000);
    forceExit.unref();

    try {
      /* Order matters: stop accepting, close sockets, then flush the buffered
       * participant writes that those disconnects just produced. */
      server.close();
      await closeRealtimeServer();
      await flushPresence();
      await Promise.allSettled([closeRedis(), closeMongo()]);

      logger.info("shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error("error during shutdown:", err?.message);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection:", reason instanceof Error ? reason.stack : reason);
  });
  process.on("uncaughtException", (err) => {
    logger.error("uncaught exception:", err?.stack ?? err?.message);
  });
}

main().catch((err) => {
  logger.error("failed to start:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
