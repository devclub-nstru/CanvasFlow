import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The limiter's shared path.
 *
 * rate-limiter.test.ts covers the in-process fallback, which is what runs when
 * REDIS_URL is blank. This file covers the other half: the GCRA script that
 * makes budgets shared across API processes, and the transition back to the
 * fallback when Redis stops answering. Neither is reachable without replacing
 * `@repo/redis`. */

const isRedisConfigured = vi.fn(() => true);
const redisReady = vi.fn();
const client = { eval: vi.fn() };

vi.mock("@repo/redis", () => ({
  isRedisConfigured,
  redisReady,
  redisKey: (...parts: Array<string | number>) => ["cf", ...parts].join(":"),
  redis: () => client,
}));

const { leakyBucketRateLimiter } = await import("../src/lib/rate-limiter");

let bucketSeq = 0;
const uniqueBucket = () => `redis-bucket-${++bucketSeq}`;

function call(req: Partial<Request> = {}) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }) as unknown as Response);
  const setHeader = vi.fn();
  const cookie = vi.fn();
  const next = vi.fn();

  return {
    req: { ip: "203.0.113.1", cookies: {}, headers: {}, ...req } as Request,
    res: { status, json, setHeader, cookie } as unknown as Response,
    next: next as unknown as NextFunction,
    json,
    status,
    setHeader,
    allowed: () => next.mock.calls.length === 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isRedisConfigured.mockReturnValue(true);
  redisReady.mockResolvedValue(client);
  client.eval.mockResolvedValue([1, 0]);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("with Redis reachable", () => {
  it("consults the shared bucket instead of the in-process one", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(client.eval).toHaveBeenCalledOnce();
    expect(c.allowed()).toBe(true);
  });

  it("passes the bucket's capacity, window and clock to the script", async () => {
    const bucket = uniqueBucket();
    const limiter = leakyBucketRateLimiter({
      bucketName: bucket,
      max: 7,
      windowMs: 60_000,
      identify: "ip",
    });

    const before = Date.now();
    const c = call({ ip: "198.51.100.5" });
    await limiter(c.req, c.res, c.next);

    const [script, keyCount, key, capacity, windowMs, now] = client.eval.mock.calls[0] as [
      string,
      number,
      string,
      string,
      string,
      string,
    ];

    expect(script).toContain("emission_interval");
    expect(keyCount).toBe(1);
    expect(key).toBe(`cf:rl:${bucket}:ip:198.51.100.5`);
    expect(capacity).toBe("7");
    expect(windowMs).toBe("60000");
    expect(Number(now)).toBeGreaterThanOrEqual(before);
  });

  it("refuses the request when the script says the bucket is empty", async () => {
    client.eval.mockResolvedValue([0, 2_500]);
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(c.allowed()).toBe(false);
    expect(c.status).toHaveBeenCalledWith(429);
    expect(c.setHeader).toHaveBeenCalledWith("Retry-After", 3);
  });

  it("evaluates both buckets in client mode", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 3, windowMs: 1000 });

    const c = call({ ip: "198.51.100.6", cookies: { cf_visitor_id: "steady" } });
    await limiter(c.req, c.res, c.next);

    expect(client.eval).toHaveBeenCalledTimes(2);
    const keys = client.eval.mock.calls.map((args) => args[2] as string);
    expect(keys.some((key) => key.includes("ip:198.51.100.6"))).toBe(true);
    expect(keys.some((key) => key.includes("visitor:steady"))).toBe(true);
  });

  it("gives the address floor the looser capacity", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 3,
      windowMs: 1000,
      ipFloorFactor: 5,
    });

    const c = call({ ip: "198.51.100.7", cookies: { cf_visitor_id: "steady" } });
    await limiter(c.req, c.res, c.next);

    const byKey = Object.fromEntries(
      client.eval.mock.calls.map((args) => [args[2] as string, args[3] as string]),
    );
    const floor = Object.entries(byKey).find(([key]) => key.includes("ip:"))?.[1];
    const perClient = Object.entries(byKey).find(([key]) => key.includes("visitor:"))?.[1];

    expect(floor).toBe("15");
    expect(perClient).toBe("3");
  });

  it("refuses as soon as any bucket refuses", async () => {
    client.eval.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 1_000]);
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 3, windowMs: 1000 });

    const c = call({ ip: "198.51.100.8", cookies: { cf_visitor_id: "steady" } });
    await limiter(c.req, c.res, c.next);

    expect(c.allowed()).toBe(false);
  });

  it("does not warn about degraded mode while Redis is answering", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("when Redis stops answering", () => {
  it("falls back to per-process limits rather than failing the request", async () => {
    client.eval.mockRejectedValue(new Error("READONLY"));
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(c.allowed()).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Redis command failed"));
  });

  it("names the underlying error, so the cause is in the log", async () => {
    client.eval.mockRejectedValue(new Error("READONLY You can't write against a replica"));
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("READONLY"));
  });

  it("still enforces a limit through the fallback", async () => {
    client.eval.mockRejectedValue(new Error("connection reset"));
    const bucket = uniqueBucket();
    const limiter = leakyBucketRateLimiter({
      bucketName: bucket,
      max: 2,
      windowMs: 60_000,
      identify: "ip",
    });

    let allowed = 0;
    for (let i = 0; i < 20; i++) {
      const c = call({ ip: "198.51.100.9" });
      await limiter(c.req, c.res, c.next);
      if (c.allowed()) allowed++;
    }

    expect(allowed).toBe(3);
  });

  it("reports an unreachable client distinctly from a failed command", async () => {
    redisReady.mockResolvedValue(null);
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Redis is unreachable"));
  });

  it("reports a missing configuration distinctly again", async () => {
    isRedisConfigured.mockReturnValue(false);
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const c = call();
    await limiter(c.req, c.res, c.next);

    expect(client.eval).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("REDIS_URL is not configured"));
  });

  it("warns once per limiter, not once per request", async () => {
    client.eval.mockRejectedValue(new Error("connection reset"));
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    for (let i = 0; i < 5; i++) {
      const c = call();
      await limiter(c.req, c.res, c.next);
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("recovers silently once Redis answers again", async () => {
    client.eval.mockRejectedValueOnce(new Error("connection reset")).mockResolvedValue([1, 0]);
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    const first = call();
    await limiter(first.req, first.res, first.next);

    const second = call();
    await limiter(second.req, second.res, second.next);

    expect(second.allowed()).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
