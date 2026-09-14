/* HTTP request metrics.
 *
 * Typed structurally rather than against Express so this package stays free of
 * a framework dependency — it is mounted by the API, and the shape below is
 * all it needs.
 */

import { counter, histogram, safely } from "./registry";
import { normalizeRoute, statusClass } from "./route";

interface MinimalRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
}

interface MinimalResponse {
  statusCode: number;
  on(event: "finish" | "close", listener: () => void): unknown;
  writableEnded?: boolean;
}

/* Buckets are a permanent decision: changing them later does not re-bucket the
 * history, it discards it. These span the range that matters for this API —
 * 50ms is a cached read, 5s is already a problem worth paging about. */
export const LATENCY_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const requestDuration = histogram({
  name: "http_request_duration_seconds",
  help: "Request duration in seconds, by route template.",
  /* Deliberately no status label: it would multiply every bucket by the number
   * of status codes. Errors are counted separately, below. */
  labelNames: ["method", "route"],
  buckets: LATENCY_BUCKETS,
});

const requestsTotal = counter({
  name: "http_requests_total",
  help: "Requests completed, by route template and status class.",
  labelNames: ["method", "route", "status_class"],
});

const requestsInFlight = counter({
  name: "http_requests_started_total",
  help: "Requests started. Subtract http_requests_total to see in-flight work.",
  labelNames: ["method"],
});

/**
 * Records duration and outcome for every request that reaches it.
 *
 * Mount before the rate limiters: a 429 is a response users experience, and a
 * limiter that has started rejecting traffic is exactly the moment you want
 * the graph to show it.
 */
export function metricsMiddleware(excludePaths: string[] = []) {
  const excluded = new Set(excludePaths);

  return function collect(req: MinimalRequest, res: MinimalResponse, next: () => void): void {
    const path = (req.originalUrl ?? req.url ?? "/").split("?")[0] ?? "/";
    if (excluded.has(path)) return next();

    const method = (req.method ?? "GET").toUpperCase();
    const startedAt = process.hrtime.bigint();

    safely(() => requestsInFlight.inc({ method }));

    /* `finish` covers a completed response; `close` catches a client that hung
     * up mid-flight, which would otherwise leave the request uncounted and
     * make the duration histogram quietly optimistic. */
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;

      safely(() => {
        const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        const route = normalizeRoute(path);

        requestDuration.observe({ method, route }, seconds);
        requestsTotal.inc({ method, route, status_class: statusClass(res.statusCode) });
      });
    };

    res.on("finish", record);
    res.on("close", record);

    next();
  };
}
