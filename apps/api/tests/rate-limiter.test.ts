import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leakyBucketRateLimiter } from "../src/lib/rate-limiter";

/* REDIS_URL is blank in the test environment, so every case exercises the
 * in-process GCRA fallback. That is deliberate: the fallback is the path that
 * runs when a deployment forgets Redis, and it is the one with no integration
 * coverage anywhere else.
 *
 * The fallback keeps its state in a module-level map keyed by bucket name, so
 * each test uses a bucket name of its own rather than resetting modules. */

let bucketSeq = 0;
function uniqueBucket(): string {
  return `test-bucket-${++bucketSeq}`;
}

interface Call {
  req: Request;
  res: Response;
  next: NextFunction;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
}

function makeCall(
  req: Partial<Request> & { ip?: string } = {},
): Call {
  const status = vi.fn();
  const json = vi.fn();
  const setHeader = vi.fn();
  const cookie = vi.fn();

  status.mockImplementation(() => ({ json }) as unknown as Response);

  const res = { status, json, setHeader, cookie } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  return {
    req: { ip: "203.0.113.1", cookies: {}, headers: {}, ...req } as Request,
    res,
    next,
    status,
    json,
    setHeader,
    cookie,
  };
}

type Limiter = ReturnType<typeof leakyBucketRateLimiter>;

async function send(limiter: Limiter, req: Partial<Request> = {}): Promise<Call> {
  const call = makeCall(req);
  await limiter(call.req, call.res, call.next);
  return call;
}

function allowed(call: Call): boolean {
  return (call.next as unknown as ReturnType<typeof vi.fn>).mock.calls.length === 1;
}

/** Sends requests until one is refused; returns how many got through. */
async function drain(limiter: Limiter, req: Partial<Request> = {}, cap = 50): Promise<number> {
  for (let i = 0; i < cap; i++) {
    const call = await send(limiter, req);
    if (!allowed(call)) return i;
  }
  return cap;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("leakyBucketRateLimiter — the happy path", () => {
  it("lets a first request through", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 5, windowMs: 1000 });
    const call = await send(limiter);
    expect(allowed(call)).toBe(true);
    expect(call.status).not.toHaveBeenCalled();
  });

  it("advertises the configured limit on every response", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 5, windowMs: 1000 });
    const call = await send(limiter);
    expect(call.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
  });
});

describe("leakyBucketRateLimiter — burst capacity", () => {
  it("allows a burst of the configured size before refusing", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 3,
      windowMs: 1000,
      identify: "ip",
    });
    /* GCRA lets the bucket start empty, so the burst is capacity + 1. */
    expect(await drain(limiter)).toBe(4);
  });

  it("answers 429 with a JSON body once the bucket is empty", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter);
    const call = await send(limiter);

    expect(allowed(call)).toBe(false);
    expect(call.status).toHaveBeenCalledWith(429);
    expect(call.json).toHaveBeenCalledWith({
      error: "Too many requests — slow down and try again shortly.",
    });
  });

  it("sets Retry-After in whole seconds, never below one", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter);
    const call = await send(limiter);

    const retry = call.setHeader.mock.calls.find(([name]) => name === "Retry-After");
    expect(retry).toBeDefined();
    expect(retry?.[1]).toBeGreaterThanOrEqual(1);
  });

  it("wraps a string message in an error object", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
      message: "calm down",
    });
    await drain(limiter);
    const call = await send(limiter);
    expect(call.json).toHaveBeenCalledWith({ error: "calm down" });
  });

  it("passes an object message through unchanged", async () => {
    const body = { error: "nope", code: "SLOW_DOWN" };
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
      message: body,
    });
    await drain(limiter);
    const call = await send(limiter);
    expect(call.json).toHaveBeenCalledWith(body);
  });
});

describe("leakyBucketRateLimiter — refill over time", () => {
  it("lets a refused caller back in once the bucket has leaked", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter);
    expect(allowed(await send(limiter))).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(allowed(await send(limiter))).toBe(true);
  });

  it("leaks gradually rather than resetting the whole bucket at once", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter);

    /* One emission interval is windowMs / max = 500ms — enough for exactly one
     * more request, not for a fresh burst. */
    vi.advanceTimersByTime(500);
    expect(allowed(await send(limiter))).toBe(true);
    expect(allowed(await send(limiter))).toBe(false);
  });
});

describe("leakyBucketRateLimiter — identity", () => {
  it("keeps separate budgets per address in ip mode", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter, { ip: "203.0.113.1" });
    expect(allowed(await send(limiter, { ip: "203.0.113.1" }))).toBe(false);
    expect(allowed(await send(limiter, { ip: "203.0.113.2" }))).toBe(true);
  });

  it("ignores caller-supplied identifiers in ip mode", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: "ip",
    });
    await drain(limiter, { ip: "203.0.113.9", cookies: { cf_visitor_id: "a" } });
    const call = await send(limiter, {
      ip: "203.0.113.9",
      cookies: { cf_visitor_id: "freshly-rotated" },
    });
    expect(allowed(call)).toBe(false);
  });

  it("buckets on whatever a custom identify function returns", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: (req) => (req.body as { email?: string })?.email ?? null,
    });

    await drain(limiter, { ip: "203.0.113.1", body: { email: "victim@example.com" } } as Partial<Request>);
    expect(
      allowed(
        await send(limiter, {
          ip: "203.0.113.77",
          body: { email: "victim@example.com" },
        } as Partial<Request>),
      ),
      "the limit follows the account, not the attacking machine",
    ).toBe(false);

    expect(
      allowed(
        await send(limiter, {
          ip: "203.0.113.1",
          body: { email: "someone-else@example.com" },
        } as Partial<Request>),
      ),
    ).toBe(true);
  });

  it("skips the limiter entirely when identify returns null", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 1,
      windowMs: 1000,
      identify: () => null,
    });

    for (let i = 0; i < 10; i++) {
      expect(allowed(await send(limiter))).toBe(true);
    }
  });
});

describe("leakyBucketRateLimiter — client mode", () => {
  it("charges a signed-in caller against their own bucket", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 1, windowMs: 1000 });

    const alice = { ip: "203.0.113.5", cookies: { cf_jwt: "alice-token" }, headers: {} };
    const bob = { ip: "203.0.113.5", cookies: { cf_jwt: "bob-token" }, headers: {} };

    await drain(limiter, alice as Partial<Request>);
    expect(allowed(await send(limiter, alice as Partial<Request>))).toBe(false);
    expect(allowed(await send(limiter, bob as Partial<Request>))).toBe(true);
  });

  it("accepts the session token from an Authorization header too", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 1, windowMs: 1000 });
    const caller = {
      ip: "203.0.113.6",
      cookies: {},
      headers: { authorization: "Bearer alice-token" },
    };

    await drain(limiter, caller as Partial<Request>);
    expect(allowed(await send(limiter, caller as Partial<Request>))).toBe(false);
  });

  it("issues a visitor cookie to a caller that sent none", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 5, windowMs: 1000 });
    const call = await send(limiter, { ip: "203.0.113.7", cookies: {} });

    expect(call.cookie).toHaveBeenCalledWith(
      "cf_visitor_id",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("does not issue a visitor cookie to a caller that already has identity", async () => {
    const limiter = leakyBucketRateLimiter({ bucketName: uniqueBucket(), max: 5, windowMs: 1000 });
    const call = await send(limiter, {
      ip: "203.0.113.8",
      cookies: { cf_visitor_id: "already-have-one" },
    });
    expect(call.cookie).not.toHaveBeenCalled();
  });

  it("holds a cookie-rotating script to the address floor", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 10_000,
      ipFloorFactor: 5,
    });

    let sent = 0;
    let refusedAt = -1;
    for (let i = 0; i < 30; i++) {
      const call = await send(limiter, {
        ip: "198.51.100.1",
        cookies: { cf_visitor_id: `rotated-${i}` },
      });
      if (!allowed(call)) {
        refusedAt = i;
        break;
      }
      sent++;
    }

    /* Without the floor this loop would never be refused: every request
     * arrives with an identity the caller just invented. The floor is
     * max * ipFloorFactor, so it binds at 11 (capacity + 1). */
    expect(refusedAt).toBe(11);
    expect(sent).toBe(11);
  });

  it("applies the tighter per-client limit ahead of the floor", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 10_000,
      ipFloorFactor: 5,
    });

    const steady = { ip: "198.51.100.2", cookies: { cf_visitor_id: "steady" }, headers: {} };
    expect(await drain(limiter, steady as Partial<Request>)).toBe(3);
  });

  it("does not charge a cookie-less caller twice for the same address", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 10_000,
      ipFloorFactor: 5,
    });

    /* The client key falls back to the address, which the floor already
     * covers, so the budget is the floor's — not half of it. */
    expect(await drain(limiter, { ip: "198.51.100.3", cookies: {} })).toBe(11);
  });
});

describe("leakyBucketRateLimiter — degraded mode", () => {
  it("warns once that budgets are per-process while Redis is unavailable", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 5,
      windowMs: 1000,
      identify: "ip",
    });

    await send(limiter);
    await send(limiter);
    await send(limiter);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("REDIS_URL is not configured"),
    );
  });

  it("still enforces a limit rather than failing open", async () => {
    const limiter = leakyBucketRateLimiter({
      bucketName: uniqueBucket(),
      max: 2,
      windowMs: 1000,
      identify: "ip",
    });
    expect(await drain(limiter)).toBeLessThan(50);
  });
});
