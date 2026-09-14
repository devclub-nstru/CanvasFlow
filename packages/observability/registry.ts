/* The metrics registry, and the rules that keep it from becoming a liability.
 *
 * Two properties matter more than the metric list itself:
 *
 *   1. Nothing here may throw into a request path. A monitoring bug must not
 *      become an outage, so every increment is swallowed (`safely`) and the
 *      whole module can be switched off with METRICS_ENABLED=false without a
 *      redeploy.
 *
 *   2. Label values are bounded. An unbounded label — a raw URL containing an
 *      id, an error message, an email — creates one time series per distinct
 *      value, and Prometheus keeps every one of them in memory. That is the
 *      normal way a metrics stack takes down the thing it was meant to watch.
 */

import cluster from "node:cluster";

import client from "prom-client";

export const register = client.register;

/** Off means: collect nothing, serve an empty scrape, cost nothing. */
export function metricsEnabled(): boolean {
  return (process.env.METRICS_ENABLED ?? "true").toLowerCase() !== "false";
}

/* Metric objects are module-level singletons, which collides with two things:
 * a re-imported module under a test runner, and prom-client's refusal to
 * register the same name twice. Reusing whatever is already registered keeps
 * both harmless. */
function reuseOrCreate<T>(name: string, create: () => T): T {
  const existing = register.getSingleMetric(name);
  if (existing) return existing as T;
  return create();
}

export function counter(config: client.CounterConfiguration<string>) {
  return reuseOrCreate(config.name, () => new client.Counter(config));
}

export function gauge(config: client.GaugeConfiguration<string>) {
  return reuseOrCreate(config.name, () => new client.Gauge(config));
}

export function histogram(config: client.HistogramConfiguration<string>) {
  return reuseOrCreate(config.name, () => new client.Histogram(config));
}

/* Instrumentation is never worth an exception. Every recording site goes
 * through here so that a mislabelled metric degrades the dashboard rather than
 * the request. */
export function safely(record: () => void): void {
  if (!metricsEnabled()) return;
  try {
    record();
  } catch {
    /* deliberately silent — see above */
  }
}

let defaultsStarted = false;

/* CPU, resident memory, heap, GC pauses and event-loop lag for this process.
 *
 * This is where "CPU / memory" actually comes from for the Node services:
 * process_cpu_seconds_total and process_resident_memory_bytes, per service,
 * without a container-level collector. Event-loop lag comes free with them and
 * is the earliest signal that a Node process is in trouble — a container
 * metrics collector cannot see it at all. */
export function collectProcessMetrics(serviceName: string): void {
  if (defaultsStarted || !metricsEnabled()) return;
  defaultsStarted = true;

  register.setDefaultLabels({ service: serviceName });
  client.collectDefaultMetrics({ register });
}

/* Cluster aggregation has two halves, and the worker half is easy to miss.
 *
 * The primary asks its workers for their registries over IPC. The responder
 * that answers that request is registered by prom-client's AggregatorRegistry
 * *constructor* — nothing else in the library sets it up, and importing
 * prom-client is not enough. A worker that never constructs one simply never
 * replies, and the primary's scrape fails with "Operation timed out" after ten
 * seconds: no metrics, no error at the point of the mistake, and a /metrics
 * endpoint that looks alive because the listener is bound.
 *
 * So every cluster worker calls this, and the primary constructs its own in
 * startMetricsServer. Harmless outside a cluster, where it does nothing. */
export function joinClusterMetrics(): void {
  if (!cluster.isWorker || !metricsEnabled()) return;
  new client.AggregatorRegistry();
}

export { client };
