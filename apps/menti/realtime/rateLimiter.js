import { redis } from "../src/core/database/redis.js";
import { redisKey } from "../src/core/env/env.js";
import { logger } from "../src/core/logger/logger.js";

/* Two limiters, because the two call sites have genuinely different needs.
 *
 * Socket events (`checkSocketRateLimit`) are limited in-process. A websocket is
 * pinned to exactly one process for its whole life, so every event from a given
 * participant is seen by the same limiter — a shared counter buys nothing, and
 * the Redis round-trip it cost was paid on *every* event. At 1000 participants
 * answering a slide that was 1000 extra round-trips sitting directly in front of
 * the handler, adding latency to the very burst it was meant to protect.
 *
 * HTTP requests (`checkRateLimit`) keep the Redis leaky bucket: they are not
 * pinned to a process, so the counter has to be shared to mean anything.
 */

/* ── In-process leaky bucket (socket events) ───────────────────────────── */

const buckets = new Map();
const BUCKET_SWEEP_INTERVAL_MS = 30_000;

let lastSweep = Date.now();

function sweepBuckets(now) {
  for (const [key, bucket] of buckets) {
    /* Fully drained and idle: nothing to remember. */
    if (bucket.water <= 0 && now - bucket.lastLeak > BUCKET_SWEEP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
  lastSweep = now;
}

export function checkSocketRateLimit(identityId, capacity = 10, leakRate = 2) {
  const now = Date.now();

  if (now - lastSweep > BUCKET_SWEEP_INTERVAL_MS) sweepBuckets(now);

  const key = String(identityId);
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { water: 1, lastLeak: now });
    return true;
  }

  const leaked = ((now - bucket.lastLeak) / 1000) * leakRate;
  const water = Math.max(0, bucket.water - leaked);

  bucket.lastLeak = now;

  if (water + 1 > capacity) {
    bucket.water = water;
    return false;
  }

  bucket.water = water + 1;
  return true;
}

/* Dropped when a socket disconnects so a churning room does not accumulate
 * one bucket per participant that ever connected. */
export function forgetRateLimitIdentity(identityId) {
  buckets.delete(String(identityId));
}

/* ── Shared leaky bucket (HTTP) ────────────────────────────────────────── */

const LEAKY_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local leak_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local bucket = redis.call("HMGET", key, "water", "last_leak")
  local water = tonumber(bucket[1]) or 0
  local last_leak = tonumber(bucket[2]) or now

  local time_passed_sec = (now - last_leak) / 1000
  local leaked = time_passed_sec * leak_rate

  water = math.max(0, water - leaked)

  if water + 1 <= capacity then
    redis.call("HMSET", key, "water", water + 1, "last_leak", now)
    local ttl = math.ceil((water + 1) / leak_rate) + 2
    redis.call("EXPIRE", key, ttl)
    return 1
  else
    redis.call("HMSET", key, "water", water, "last_leak", now)
    return 0
  end
`;

redis.defineCommand("leakyBucket", { numberOfKeys: 1, lua: LEAKY_BUCKET_SCRIPT });

export const checkRateLimit = async (
  identityId,
  action = "http_request",
  capacity = 10,
  leakRate = 2,
) => {
  const key = redisKey("ratelimit", action, identityId);

  try {
    const result = await redis.leakyBucket(key, capacity, leakRate, Date.now());
    return result === 1;
  } catch (error) {
    logger.error("rate limiter error:", error.message);
    /* Redis is the shared counter for HTTP; if it is unavailable the request
     * still has to go somewhere, and dropping legitimate joins is worse than
     * briefly unmetered traffic that the socket layer will limit anyway. */
    return true;
  }
};
