/* The scrape endpoint.
 *
 * Served on its own port, never on the application's. Two reasons:
 *
 *   1. /metrics is unauthenticated and describes the internals of the service.
 *      On a separate port it is trivially kept off the public reverse proxy —
 *      it is simply never proxied — rather than relying on a path exclusion
 *      that a later config edit could undo.
 *
 *   2. apps/api can run clustered (CLUSTER_WORKERS > 1), and a port shared by
 *      cluster workers is load-balanced across them. A scrape would land on
 *      one arbitrary worker and report a fraction of every counter, which
 *      looks like working monitoring and is not. When clustered, the primary
 *      aggregates the workers' registries over IPC and answers here.
 */

import http from "node:http";
import cluster from "node:cluster";

import { logger } from "@repo/logger";

import { client, metricsEnabled, register } from "./registry";

export interface MetricsServerOptions {
  port: number;
  /** Used in log lines only; the metric label comes from collectProcessMetrics. */
  serviceName: string;
  /**
   * Aggregate the cluster workers' metrics instead of this process's own.
   * Set on the primary when workers have been forked.
   */
  aggregateCluster?: boolean;
}

export interface MetricsServer {
  close(): Promise<void>;
}

export function startMetricsServer(options: MetricsServerOptions): MetricsServer | null {
  if (!metricsEnabled()) {
    logger.info(`[metrics] disabled for ${options.serviceName} (METRICS_ENABLED=false)`);
    return null;
  }

  const aggregator = options.aggregateCluster ? new client.AggregatorRegistry() : null;

  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (path !== "/metrics") {
      res.statusCode = 404;
      res.end("not found\n");
      return;
    }

    const body = aggregator ? aggregator.clusterMetrics() : register.metrics();

    body
      .then((text) => {
        res.setHeader("Content-Type", aggregator ? aggregator.contentType : register.contentType);
        res.end(text);
      })
      .catch((err: unknown) => {
        /* A failed scrape must not take the process with it. Prometheus will
         * mark the target down, which is the correct signal. */
        logger.error(`[metrics] scrape failed: ${err instanceof Error ? err.message : err}`);
        res.statusCode = 500;
        res.end("# scrape failed\n");
      });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    /* Never fatal. Losing metrics is strictly better than losing the service
     * that produces them. */
    logger.error(`[metrics] listener error on port ${options.port}: ${err.message}`);
  });

  /* Not part of the work the process exists to do, so it must never be the
   * reason the event loop stays alive. */
  server.listen(options.port, () => {
    server.unref();
    logger.info(
      `[metrics] ${options.serviceName} exposing /metrics on ${options.port}` +
        (aggregator ? ` (aggregating ${Object.keys(cluster.workers ?? {}).length} workers)` : ""),
    );
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
