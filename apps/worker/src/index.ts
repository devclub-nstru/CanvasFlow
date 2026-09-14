import crypto from "node:crypto";
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: crypto.webcrypto,
    writable: false,
    configurable: true,
  });
}

import http from "node:http";
import https from "node:https";

import { logger } from "@repo/logger";
import { closeRedis, isRedisConfigured } from "@repo/redis";
import { createUploadWorker, queueEnv, uploadQueueCounts, QUEUE_UPLOADS } from "@repo/queue";
import {
  collectProcessMetrics,
  recordQueueDepth,
  recordQueueJob,
  startMetricsServer,
} from "@repo/observability";

import { env, isCloudinaryConfigured } from "./env";
import { cloudinaryStorage } from "./storage";
import { createUploadProcessor } from "./processors/upload";

const agentOptions = { keepAlive: true, maxSockets: 256, maxFreeSockets: 32 };
http.globalAgent = new http.Agent(agentOptions);
https.globalAgent = new https.Agent(agentOptions);

async function main() {
  if (!isRedisConfigured()) {
    logger.error("[worker] REDIS_URL is not set — the worker has no queues to consume");
    process.exit(1);
  }

  if (!isCloudinaryConfigured()) {
    logger.warn(
      "[worker] Cloudinary is not configured. Upload jobs will be failed with a clear " +
        "message. Set CLOUDINARY_CLOUD_NAME, " +
        "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable file storage." +
        " If this is development, you can proceed without it.",
    );
  }

  collectProcessMetrics("worker");
  const metrics = startMetricsServer({ port: env.METRICS_PORT, serviceName: "worker" });

  const uploadWorker = createUploadWorker(createUploadProcessor(cloudinaryStorage));

  uploadWorker.on("completed", () => {
    recordQueueJob(QUEUE_UPLOADS, "completed");
  });
  uploadWorker.on("failed", (job, err) => {
    /* Counted on every attempt, not only the last. BullMQ retries four times
     * with exponential backoff, so a rising failure count against a flat
     * completed count is the shape of a job that will eventually give up —
     * visible well before it lands in the failed set. */
    recordQueueJob(QUEUE_UPLOADS, "failed");
    logger.error(`[worker:upload] job ${job?.id ?? "unknown"} failed: ${err.message}`);
  });
  uploadWorker.on("error", (err) => {
    logger.error(`[worker:upload] worker error: ${err.message}`);
  });

  /* Depth has no event to hang off, so it is polled. Failures are swallowed:
   * Redis being briefly unreachable should stale the gauge, not kill the
   * worker that is otherwise still draining its queue. */
  const pollDepth = async () => {
    try {
      recordQueueDepth(QUEUE_UPLOADS, await uploadQueueCounts());
    } catch {
      /* next tick will retry */
    }
  };

  const depthTimer = setInterval(() => void pollDepth(), env.METRICS_QUEUE_POLL_MS);
  depthTimer.unref();
  void pollDepth();

  logger.info(
    `[worker] listening — uploads x${queueEnv.UPLOAD_WORKER_CONCURRENCY} (${env.NODE_ENV})`,
  );

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`[worker] ${signal} received, finishing in-flight jobs...`);

    const forceExit = setTimeout(() => {
      logger.error("[worker] shutdown timed out, exiting");
      process.exit(1);
    }, 25_000);
    forceExit.unref();

    clearInterval(depthTimer);

    try {
      await Promise.allSettled([uploadWorker.close(), metrics?.close()]);
      await closeRedis();
      logger.info("[worker] stopped cleanly");
      process.exit(0);
    } catch (err) {
      logger.error(`[worker] shutdown error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error(`[worker] failed to start: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
