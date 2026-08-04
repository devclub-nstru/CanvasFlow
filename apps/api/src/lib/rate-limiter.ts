import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
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

export function leakyBucketRateLimiter(opts: RateLimiterOptions) {
  const { bucketName, max, windowMs, message } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isRedisConfigured()) {
      return next();
    }

    try {
      const client = await redisReady();
      if (!client) {
        return next();
      }

      // 1. Identify client
      let clientKey = "";

      // Try resolving auth session token
      const sessionToken = req.headers.cookie?.match(/better-auth\.session_token=([^;]+)/)?.[1];
      if (sessionToken) {
        clientKey = `session:${sessionToken}`;
      } else {
        // Fallback to visitor cookie
        let visitorId = req.cookies?.["cf_visitor_id"] as string | undefined;
        if (!visitorId) {
          visitorId = randomUUID();
          res.cookie("cf_visitor_id", visitorId, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
        }
        clientKey = `visitor:${visitorId}`;
      }

      const key = `${redisKey("rl", bucketName)}:${clientKey}`;
      const now = Date.now();

      // Execute atomic GCRA script
      const result = (await client.eval(
        gcraScript,
        1,
        key,
        max.toString(),
        windowMs.toString(),
        now.toString(),
      )) as [number, number];

      const [allowed, retryAfterMs] = result;

      if (allowed === 1) {
        res.setHeader("X-RateLimit-Limit", max);
        return next();
      } else {
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
        res.setHeader("Retry-After", retryAfterSec);
        res.setHeader("X-RateLimit-Limit", max);

        const errorMsg = message || {
          error: "Too many requests — slow down and try again shortly.",
        };
        return res.status(429).json(typeof errorMsg === "string" ? { error: errorMsg } : errorMsg);
      }
    } catch (err) {
      console.error("[rate-limiter] error executing leaky bucket:", err);
      return next();
    }
  };
}
