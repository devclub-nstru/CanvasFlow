import { redisReady, redis, redisEnv } from "@repo/redis";

/* The suite uses its own REDIS_PREFIX ("cftest"), so clearing is a scan over
 * that namespace rather than a FLUSHDB — which would wipe a developer's dev
 * stack if the two ever shared an instance.
 *
 * `redisReady()` rather than `redis()`: the client is built lazily with
 * `enableOfflineQueue: false`, so the first command issued against a
 * still-connecting client is rejected outright rather than queued. That made
 * the first test of every file fail with "Stream isn't writeable". */

export async function resetRedis(): Promise<void> {
  const client = await redisReady();
  if (!client) return;

  const pattern = `${redisEnv.REDIS_PREFIX}:*`;
  let cursor = "0";

  do {
    const [next, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = next;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== "0");
}

export async function closeRedis(): Promise<void> {
  const client = redis();
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
