import type { Request, Response, NextFunction } from "express";
import { createHash, randomUUID } from "node:crypto";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";

interface RateLimiterOptions {
  bucketName: string;
  max: number; // Bucket capacity (max burst size)
  windowMs: number; // Time window in milliseconds (leak duration)
  message?: string | object;
  /* How a caller is bucketed.
   *
   * "client" is the default: session token, else visitor cookie, else peer
   * address. Right for ordinary app traffic, where the cookie is a more stable
   * identity than an address shared by everyone behind one NAT.
   *
   * "ip" ignores caller-supplied identifiers entirely. Required for
   * credential endpoints: an attacker chooses their own cookie and bearer
   * token, so a bucket keyed on either is one a brute-force can reset at will
   * simply by rotating the value.
   *
   * A function keys the bucket on something request-specific — the submitted
   * email address, say — so the limit follows the account being attacked
   * rather than the machine attacking it. Returning null skips the limiter. */
  identify?: "client" | "ip" | ((req: Request) => string | null);
  /* Capacity multiplier for the IP floor that "client" mode always applies
   * alongside the per-client bucket. The floor has to be looser than the
   * per-client limit or a shared NAT — a lecture hall on one WiFi, which is
   * exactly this product's audience — would throttle legitimate users. Loose
   * but finite is the point: it bounds a cookie-rotating script without
   * punishing co-located people. */
  ipFloorFactor?: number;
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

/* Default looseness of the always-on IP floor relative to the per-client
 * limit. Five means a single address may spend five clients' worth of budget
 * before it is throttled. */
const DEFAULT_IP_FLOOR_FACTOR = 5;
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

interface Bucket {
  key: string;
  capacity: number;
}

export function leakyBucketRateLimiter(opts: RateLimiterOptions) {
  const {
    bucketName,
    max,
    windowMs,
    message,
    identify = "client",
    ipFloorFactor = DEFAULT_IP_FLOOR_FACTOR,
  } = opts;

  /* Which buckets a request is charged against.
   *
   * "client" mode used to return a single key, preferring the session token,
   * then the cf_visitor_id cookie, and only falling back to the peer address
   * when neither was present. Both preferred identifiers are chosen by the
   * caller, so a script sending a fresh random cookie on every request was
   * handed a fresh budget on every request and the limit did nothing.
   *
   * The address is now always charged as a floor, with the per-client bucket
   * layered on top as the tighter limit. Rotating a cookie no longer buys
   * anything: the floor is keyed on something the caller cannot choose. */
  const resolveBuckets = (req: Request, res: Response): Bucket[] | null => {
    const ipKey = `ip:${req.ip ?? "unknown"}`;

    if (identify === "ip") return [{ key: ipKey, capacity: max }];

    if (typeof identify === "function") {
      const key = identify(req);
      if (key === null) return null;
      return [{ key: `key:${fingerprint(key)}`, capacity: max }];
    }

    const clientKey = identifyClient(req, res);
    const buckets: Bucket[] = [{ key: ipKey, capacity: max * ipFloorFactor }];

    /* identifyClient falls back to the address itself when no cookie came
     * back, in which case the floor already covers it — charging the same key
     * twice would just halve the budget. */
    if (clientKey !== ipKey) buckets.push({ key: clientKey, capacity: max });

    return buckets;
  };

  let warnedAboutFallback = false;
  const noteFallback = (reason: string) => {
    if (warnedAboutFallback) return;
    warnedAboutFallback = true;
    console.warn(
      `[rate-limiter] ${reason} — falling back to per-process limits for "${bucketName}". ` +
        `Budgets are multiplied by the number of API processes until Redis is reachable.`,
    );
  };

  const consume = async (
    bucket: Bucket,
    now: number,
  ): Promise<[allowed: number, retryAfterMs: number]> => {
    const key = `${redisKey("rl", bucketName)}:${bucket.key}`;

    try {
      const client = isRedisConfigured() ? await redisReady() : null;

      if (client) {
        return (await client.eval(
          gcraScript,
          1,
          key,
          bucket.capacity.toString(),
          windowMs.toString(),
          now.toString(),
        )) as [number, number];
      }

      noteFallback(isRedisConfigured() ? "Redis is unreachable" : "REDIS_URL is not configured");
      return localGcra(key, bucket.capacity, windowMs, now);
    } catch (err) {
      noteFallback(`Redis command failed (${err instanceof Error ? err.message : err})`);
      return localGcra(key, bucket.capacity, windowMs, now);
    }
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const buckets = resolveBuckets(req, res);

    /* Nothing to bucket on — a credential request with no email in the body,
     * for example. The handler will reject it on its own merits. */
    if (buckets === null) return next();

    const now = Date.now();

    let allowed = 1;
    let retryAfterMs = 0;

    /* Every bucket is evaluated, and the request is denied if any of them
     * denies. A bucket may be charged for a request another bucket then
     * rejects, so under sustained abuse the effective limit is marginally
     * stricter than the nominal one — the safe direction to be imprecise in. */
    for (const bucket of buckets) {
      const [bucketAllowed, bucketRetry] = await consume(bucket, now);
      if (bucketAllowed !== 1) {
        allowed = 0;
        retryAfterMs = Math.max(retryAfterMs, bucketRetry);
      }
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
