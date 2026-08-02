import RedisStore from "rate-limit-redis";
import type { Store } from "express-rate-limit";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";

export function redisRateLimitStore(bucket: string): Store | undefined {
  if (!isRedisConfigured()) return undefined;

  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      const connection = await redisReady();
      if (!connection) throw new Error("Redis unavailable for rate limiting");

      return (connection as unknown as { call: (...a: string[]) => Promise<never> }).call(...args);
    },

    prefix: `${redisKey("rl", bucket)}:`,
  }) as unknown as Store;
}
