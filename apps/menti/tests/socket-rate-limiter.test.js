import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redis = { defineCommand: vi.fn(), leakyBucket: vi.fn() };
vi.mock("../src/core/database/redis.js", () => ({
  redis,
  createSubscriber: vi.fn(),
  closeRedis: vi.fn(),
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/core/logger/logger.js", () => ({ logger, default: logger }));

const { checkSocketRateLimit, forgetRateLimitIdentity, checkRateLimit } = await import(
  "../realtime/rateLimiter.js"
);

/* Captured before the per-test clearAllMocks: the script is registered once,
 * at import, so the call record would otherwise be wiped before it is read. */
const defineCommandCalls = [...redis.defineCommand.mock.calls];

/* The in-process buckets live in module state shared by the whole file, so
 * every case uses an identity of its own instead of resetting the module. */
let seq = 0;
const identity = () => `participant-${++seq}`;

/** Sends events until one is refused; returns how many were allowed. */
function drain(id, capacity, leakRate, cap = 200) {
  for (let i = 0; i < cap; i++) {
    if (!checkSocketRateLimit(id, capacity, leakRate)) return i;
  }
  return cap;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkSocketRateLimit", () => {
  it("lets a participant's first event through", () => {
    expect(checkSocketRateLimit(identity())).toBe(true);
  });

  it("allows a burst up to the capacity, then refuses", () => {
    expect(drain(identity(), 10, 2)).toBe(10);
  });

  it("honours a capacity other than the default", () => {
    expect(drain(identity(), 3, 2)).toBe(3);
  });

  it("defaults to a capacity of ten", () => {
    const id = identity();
    for (let i = 0; i < 10; i++) expect(checkSocketRateLimit(id)).toBe(true);
    expect(checkSocketRateLimit(id)).toBe(false);
  });

  it("keeps a separate bucket per participant", () => {
    const noisy = identity();
    const quiet = identity();
    drain(noisy, 3, 2);
    expect(checkSocketRateLimit(noisy, 3, 2)).toBe(false);
    expect(checkSocketRateLimit(quiet, 3, 2)).toBe(true);
  });

  it("treats a numeric and a string identity as the same participant", () => {
    const id = 987654;
    drain(id, 2, 2);
    expect(checkSocketRateLimit(String(id), 2, 2)).toBe(false);
  });

  it("leaks at the configured rate", () => {
    const id = identity();
    drain(id, 4, 2);
    expect(checkSocketRateLimit(id, 4, 2)).toBe(false);

    /* Two per second: half a second buys back exactly one event. */
    vi.advanceTimersByTime(500);
    expect(checkSocketRateLimit(id, 4, 2)).toBe(true);
    expect(checkSocketRateLimit(id, 4, 2)).toBe(false);
  });

  it("refills the whole bucket after enough quiet time", () => {
    const id = identity();
    drain(id, 4, 2);
    vi.advanceTimersByTime(4_000);
    expect(drain(id, 4, 2)).toBe(4);
  });

  it("never lets the bucket refill past its capacity", () => {
    const id = identity();
    checkSocketRateLimit(id, 3, 2);
    vi.advanceTimersByTime(60_000);
    expect(drain(id, 3, 2)).toBe(3);
  });

  it("does not charge the bucket for a refused event", () => {
    const id = identity();
    drain(id, 2, 2);
    for (let i = 0; i < 20; i++) checkSocketRateLimit(id, 2, 2);

    /* Refusals left the water level alone, so one emission interval is still
     * enough to buy exactly one event back. */
    vi.advanceTimersByTime(500);
    expect(checkSocketRateLimit(id, 2, 2)).toBe(true);
  });

  it("sustains a steady rate indefinitely without tripping", () => {
    const id = identity();
    for (let i = 0; i < 100; i++) {
      expect(checkSocketRateLimit(id, 10, 2)).toBe(true);
      vi.advanceTimersByTime(500);
    }
  });
});

describe("forgetRateLimitIdentity", () => {
  it("clears a participant's bucket when their socket goes away", () => {
    const id = identity();
    drain(id, 2, 2);
    expect(checkSocketRateLimit(id, 2, 2)).toBe(false);

    forgetRateLimitIdentity(id);
    expect(checkSocketRateLimit(id, 2, 2)).toBe(true);
  });

  it("is safe to call for a participant that was never limited", () => {
    expect(() => forgetRateLimitIdentity("never-seen")).not.toThrow();
  });

  it("accepts a numeric identity", () => {
    const id = 424242;
    drain(id, 1, 2);
    forgetRateLimitIdentity(id);
    expect(checkSocketRateLimit(id, 1, 2)).toBe(true);
  });
});

describe("checkRateLimit — the shared HTTP bucket", () => {
  it("registers the Lua script once, at import", () => {
    expect(defineCommandCalls).toHaveLength(1);
    const [name, definition] = defineCommandCalls[0];
    expect(name).toBe("leakyBucket");
    expect(definition.numberOfKeys).toBe(1);
    expect(definition.lua).toContain("HMSET");
  });

  it("allows the request when Redis says the bucket has room", async () => {
    redis.leakyBucket.mockResolvedValue(1);
    await expect(checkRateLimit("visitor-1")).resolves.toBe(true);
  });

  it("refuses the request when Redis says the bucket is full", async () => {
    redis.leakyBucket.mockResolvedValue(0);
    await expect(checkRateLimit("visitor-1")).resolves.toBe(false);
  });

  it("keys the bucket under the menti namespace, per action and identity", async () => {
    redis.leakyBucket.mockResolvedValue(1);
    await checkRateLimit("visitor-1", "join_session");

    const [key, capacity, leakRate] = redis.leakyBucket.mock.calls[0];
    expect(key).toBe("cf:menti:ratelimit:join_session:visitor-1");
    expect(capacity).toBe(10);
    expect(leakRate).toBe(2);
  });

  it("defaults the action so a caller need not name one", async () => {
    redis.leakyBucket.mockResolvedValue(1);
    await checkRateLimit("visitor-1");
    expect(redis.leakyBucket.mock.calls[0][0]).toContain("http_request");
  });

  it("passes a caller-supplied capacity and leak rate through", async () => {
    redis.leakyBucket.mockResolvedValue(1);
    await checkRateLimit("visitor-1", "join_session", 50, 5);
    const [, capacity, leakRate] = redis.leakyBucket.mock.calls[0];
    expect(capacity).toBe(50);
    expect(leakRate).toBe(5);
  });

  it("fails open when Redis is unreachable, and says so in the log", async () => {
    redis.leakyBucket.mockRejectedValue(new Error("connection reset"));
    await expect(checkRateLimit("visitor-1")).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith("rate limiter error:", "connection reset");
  });
});
