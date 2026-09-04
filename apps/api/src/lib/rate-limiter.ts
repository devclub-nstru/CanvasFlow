import type { Request, Response, NextFunction } from "express";
import { createHash, randomUUID } from "node:crypto";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";

interface RateLimiterOptions {
  bucketName: string;
  max: number; // Bucket capacity (max burst size)
  windowMs: number; // Time window in milliseconds (leak duration)
  message?: string | object;
}

const gcraScript = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local emission_interval = window_ms / capacity
local limit = capacity * emission_interval

local tat = tonumber(redis.call('GET', key))

if not tat then
  tat = now
else
  tat = math.max(tat, now)
end

local tat_diff = tat - now

if tat_diff > limit then
  return {0, math.ceil(tat_diff - limit)}
else
  local new_tat = tat + emission_interval
  redis.call('SET', key, new_tat, 'PX', math.ceil(new_tat - now))
  return {1, 0}
end
`;

/* ── Local fallback ────────────────────────────────────────────────────────
 *
 * This used to call next() whenever Redis was unconfigured or unreachable,
 * which meant a Redis outage — or a deployment that simply never set
 * REDIS_URL — removed rate limiting entirely rather than degrading it. The
 * same GCRA arithmetic runs in-process instead.
 *
 * Per-process state is a real weakening, not an equivalent: with N clustered
 * workers a client gets up to N times the intended budget, and the counters
 * reset on restart. That is the deliberate trade — a limit that is N times too
 * loose still bounds abuse, while no limit at all does not.
 */

const localTat = new Map<string, number>();

/* Bounds the map when Redis is down and traffic is spread over many keys.
 * Entries are cheap (a key and a float) so this is generous; the sweep below
 * keeps it from ever being reached under normal churn. */
const MAX_LOCAL_KEYS = 100_000;
const SWEEP_EVERY = 5_000;
let opsSinceSweep = 0;

function sweepLocal(now: number): void {
  for (const [key, tat] of localTat) {
    if (tat <= now) localTat.delete(key);
  }

  /* Still oversized after dropping everything expired: the traffic is genuinely
   * high-cardinality. Drop from the front (oldest insertion) so live limits
   * survive rather than being evicted at random. */
  if (localTat.size > MAX_LOCAL_KEYS) {
    const excess = localTat.size - MAX_LOCAL_KEYS;
    let dropped = 0;
    for (const key of localTat.keys()) {
      localTat.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

function localGcra(
  key: string,
  capacity: number,
  windowMs: number,
  now: number,
): [allowed: 0 | 1, retryAfterMs: number] {
  if (++opsSinceSweep >= SWEEP_EVERY || localTat.size > MAX_LOCAL_KEYS) {
    opsSinceSweep = 0;
    sweepLocal(now);
  }

  const emissionInterval = windowMs / capacity;
  const limit = capacity * emissionInterval;

  const tat = Math.max(localTat.get(key) ?? now, now);
  const tatDiff = tat - now;

  if (tatDiff > limit) return [0, Math.ceil(tatDiff - limit)];

  const newTat = tat + emissionInterval;
  localTat.set(key, newTat);
  return [1, 0];
}

/* ── Client identity ───────────────────────────────────────────────────────
 *
 * Signed-in callers are bucketed by session, everyone else by a long-lived
 * visitor cookie, falling back to the peer address when cookies are refused.
 * The session token is hashed rather than used directly: it keeps bearer
 * material out of Redis keys and out of any log line that echoes one.
 */

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}

function identifyClient(req: Request, res: Response): string {
  const sessionToken =
    req.cookies?.["cf_jwt"] ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (sessionToken) return `session:${fingerprint(sessionToken)}`;

  const visitorId = req.cookies?.["cf_visitor_id"] as string | undefined;
  if (visitorId) return `visitor:${visitorId}`;

  /* No cookie came back. Issue one for next time, but bucket *this* request by
   * peer address: a client that drops cookies would otherwise be handed a
   * fresh identity on every request and never accumulate against any bucket. */
  res.cookie("cf_visitor_id", randomUUID(), {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return `ip:${req.ip ?? "unknown"}`;
}

export function leakyBucketRateLimiter(opts: RateLimiterOptions) {
  const { bucketName, max, windowMs, message } = opts;

  let warnedAboutFallback = false;
  const noteFallback = (reason: string) => {
    if (warnedAboutFallback) return;
    warnedAboutFallback = true;
    console.warn(
      `[rate-limiter] ${reason} — falling back to per-process limits for "${bucketName}". ` +
        `Budgets are multiplied by the number of API processes until Redis is reachable.`,
    );
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientKey = identifyClient(req, res);
    const key = `${redisKey("rl", bucketName)}:${clientKey}`;
    const now = Date.now();

    let allowed: number;
    let retryAfterMs: number;

    try {
      const client = isRedisConfigured() ? await redisReady() : null;

      if (client) {
        const result = (await client.eval(
          gcraScript,
          1,
          key,
          max.toString(),
          windowMs.toString(),
          now.toString(),
        )) as [number, number];

        [allowed, retryAfterMs] = result;
      } else {
        noteFallback(isRedisConfigured() ? "Redis is unreachable" : "REDIS_URL is not configured");
        [allowed, retryAfterMs] = localGcra(key, max, windowMs, now);
      }
    } catch (err) {
      noteFallback(`Redis command failed (${err instanceof Error ? err.message : err})`);
      [allowed, retryAfterMs] = localGcra(key, max, windowMs, now);
    }

    res.setHeader("X-RateLimit-Limit", max);

    if (allowed === 1) return next();

    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)));

    const errorMsg = message || {
      error: "Too many requests — slow down and try again shortly.",
    };
    return res.status(429).json(typeof errorMsg === "string" ? { error: errorMsg } : errorMsg);
  };
}
