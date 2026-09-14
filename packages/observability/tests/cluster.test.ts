import { afterEach, describe, expect, it, vi } from "vitest";

/* Cluster aggregation has a worker half that nothing forces you to write.
 *
 * The primary asks each worker for its registry over IPC. The responder that
 * answers is registered by prom-client's AggregatorRegistry *constructor* —
 * importing prom-client does not do it, and neither does collecting metrics.
 * A worker that never constructs one never replies, and the primary's scrape
 * fails with "Operation timed out" after ten seconds.
 *
 * That failure is quiet in the worst way: the /metrics port stays bound and
 * answering, so the endpoint looks alive while reporting nothing at all.
 *
 * These tests assert the half that lives in this repo — that a worker, and
 * only a worker, constructs one. prom-client's own IPC wiring is not mockable
 * from here: its cluster module `require`s bare "cluster" and would see the
 * real one regardless. The end-to-end behaviour is verified by running the API
 * with CLUSTER_WORKERS > 1 and scraping the primary. */

afterEach(() => {
  delete process.env.METRICS_ENABLED;
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("node:cluster");
});

async function loadWith(isWorker: boolean) {
  vi.doMock("node:cluster", () => ({ default: { isWorker, isPrimary: !isWorker } }));

  const mod = await import("../registry");
  const spy = vi.spyOn(mod.client, "AggregatorRegistry").mockImplementation(function (
    this: unknown,
  ) {
    return this;
  } as never);

  return { joinClusterMetrics: mod.joinClusterMetrics, spy };
}

describe("joinClusterMetrics", () => {
  it("constructs the aggregator in a cluster worker", async () => {
    const { joinClusterMetrics, spy } = await loadWith(true);

    joinClusterMetrics();

    expect(
      spy,
      "constructing it is what registers the IPC responder — without it the primary's " +
        "scrape times out and reports nothing",
    ).toHaveBeenCalledTimes(1);
  });

  it("does nothing in a single process", async () => {
    const { joinClusterMetrics, spy } = await loadWith(false);

    joinClusterMetrics();

    expect(spy).not.toHaveBeenCalled();
  });

  it("respects the kill switch", async () => {
    const { joinClusterMetrics, spy } = await loadWith(true);
    process.env.METRICS_ENABLED = "false";

    joinClusterMetrics();

    expect(spy).not.toHaveBeenCalled();
  });
});
