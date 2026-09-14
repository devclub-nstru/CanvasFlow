import crypto from "node:crypto";
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: crypto.webcrypto,
    writable: false,
    configurable: true,
  });
}

import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";

import { logger } from "@repo/logger";
import { closeDb } from "@repo/database";
import { closeRedis } from "@repo/redis";
import { drainProducers } from "@repo/queue";
import { assertAuthSecret } from "@repo/trpc/server/auth";
import { reportMailConfiguration } from "@repo/services/mail";
import {
  collectProcessMetrics,
  joinClusterMetrics,
  startMetricsServer,
} from "@repo/observability";

import { app as expressApplication } from "./server";
import { env } from "./env";

const PORT: number = env.PORT ? +env.PORT : 8000;
const requestedWorkers = env.CLUSTER_WORKERS;
const workerCount = Math.min(requestedWorkers, os.availableParallelism?.() ?? os.cpus().length);

function warnOnConnectionBudget() {
  const processes = Math.max(workerCount, 1);
  const total = processes * env.DB_POOL_MAX;

  const COMMON_DEFAULT_MAX = 100;

  if (total > COMMON_DEFAULT_MAX) {
    logger.warn(
      `database connection budget: ${processes} process(es) x DB_POOL_MAX=${env.DB_POOL_MAX} = ` +
        `${total} connections. Postgres allows 100 by default — if it hasn't been raised, ` +
        `expect "too many clients already" under load. Either raise max_connections, lower ` +
        `DB_POOL_MAX to <= ${Math.floor(COMMON_DEFAULT_MAX / processes)}, or put pgBouncer in front.`,
    );
  }
}

function startServer() {
  /* Per-process CPU, resident memory, heap, GC and event-loop lag. This is
   * where "CPU / memory" comes from for the Node tier. */
  collectProcessMetrics("api");

  /* A cluster worker shares PORT with its siblings but not METRICS_PORT, so
   * only the primary may bind it — otherwise every worker but the first dies
   * with EADDRINUSE. When clustered, the primary aggregates instead (see
   * init()); a lone process serves its own registry here.
   *
   * The worker's side of that aggregation is joinClusterMetrics: without it
   * the primary's scrape times out, because nothing answers its IPC request. */
  joinClusterMetrics();

  const metrics = cluster.isWorker
    ? null
    : startMetricsServer({ port: env.METRICS_PORT, serviceName: "api" });

  const server = http.createServer(expressApplication);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  server.requestTimeout = 0;
  const BACKLOG = 2048;

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" || err.code === "EACCES") {
      logger.error(`cannot bind port ${PORT}: ${err.code}. Exiting.`);
      process.exit(1);
    }
    logger.error(`http server error: ${err.message}`);
  });

  server.listen(PORT, BACKLOG, () => {
    logger.info(
      `http server listening on ${PORT}` +
        (cluster.isWorker ? ` (worker ${process.pid})` : " (single process)"),
    );
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received — draining connections...`);

    const forceExit = setTimeout(() => {
      logger.error("shutdown timed out — exiting");
      process.exit(1);
    }, 25_000);
    forceExit.unref();

    server.close(async () => {
      try {
        await drainProducers();
        await Promise.allSettled([closeRedis(), closeDb(), metrics?.close()]);
        logger.info("shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error(`error during shutdown: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error(`unhandled promise rejection: ${reason instanceof Error ? reason.stack : reason}`);
  });

  process.on("uncaughtException", (err) => {
    logger.error(`uncaught exception: ${err.stack ?? err.message}`);
  });
}

function init() {
  try {
    if (workerCount > 1 && cluster.isPrimary) {
      logger.info(`primary ${process.pid} forking ${workerCount} workers`);
      warnOnConnectionBudget();

      for (let i = 0; i < workerCount; i += 1) cluster.fork();

      /* Scraping a cluster-shared port would reach one arbitrary worker and
       * report a fraction of every counter. The primary holds no request
       * state of its own, so it aggregates the workers' registries over IPC
       * and answers the scrape for all of them. */
      startMetricsServer({
        port: env.METRICS_PORT,
        serviceName: "api",
        aggregateCluster: true,
      });

      let primaryShuttingDown = false;

      cluster.on("exit", (worker, code, signal) => {
        if (primaryShuttingDown || worker.exitedAfterDisconnect) return;

        logger.error(
          `worker ${worker.process.pid} died (${signal || code}) — forking a replacement`,
        );
        cluster.fork();
      });

      const relay = (signal: NodeJS.Signals) => {
        if (primaryShuttingDown) return;
        primaryShuttingDown = true;

        logger.info(`primary ${process.pid} relaying ${signal} to ${workerCount} worker(s)`);
        for (const worker of Object.values(cluster.workers ?? {})) worker?.kill(signal);

        const giveUp = setTimeout(() => {
          logger.error("workers did not exit in time — primary exiting");
          process.exit(1);
        }, 28_000);
        giveUp.unref();

        const waitForWorkers = setInterval(() => {
          if (Object.keys(cluster.workers ?? {}).length === 0) {
            clearInterval(waitForWorkers);
            logger.info("all workers stopped — primary exiting");
            process.exit(0);
          }
        }, 200);
      };

      process.on("SIGTERM", () => relay("SIGTERM"));
      process.on("SIGINT", () => relay("SIGINT"));

      return;
    }

    if (!cluster.isWorker) warnOnConnectionBudget();
    startServer();
  } catch (err) {
    logger.error(`Error creating http server`, { err });
    process.exit(1);
  }
}

try {
  assertAuthSecret();
} catch (err) {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

reportMailConfiguration();

init();
