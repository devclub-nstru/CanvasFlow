import Redis from "ioredis";
import env from "../env/env.js";
import { logger } from "../logger/logger.js";

/* Menti now shares the monorepo's Redis instance with the API's cache, rate
 * limiter, and BullMQ queues. Every key this service writes goes through
 * `redisKey()` from env.js, which prefixes it with `<REDIS_PREFIX>:menti:`, so
 * the two cannot collide.
 */

if (!env.REDIS_URL) {
  throw new Error(
    "REDIS_URL is not set. Menti requires Redis for rate limiting, the PPTX job " +
      "queue, cross-process participant counts, and the Socket.io adapter.",
  );
}

function build(role) {
  const client = new Redis(env.REDIS_URL, {
    /* A dropped Redis connection must not become a dropped websocket. Retry
     * indefinitely with a capped backoff instead of surfacing errors into the
     * realtime layer. */
    retryStrategy: (times) => Math.min(times * 200, 2_000),
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  });

  client.on("connect", () => logger.info(`redis connected (${role})`));
  client.on("error", (err) => logger.error(`redis error (${role}):`, err.message));

  return client;
}

export const redis = build("commands");

/* The Socket.io Redis adapter and the import-progress listener each need their
 * own connection: a client in subscriber mode cannot issue normal commands. */
export const createSubscriber = (role = "subscriber") => build(role);

export async function closeRedis() {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
