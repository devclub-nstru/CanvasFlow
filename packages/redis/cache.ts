import { redisKey, redisReady } from "./index";
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const client = await redisReady();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await redisReady();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* Nothing to do and nothing to tell the caller: the read path will simply
     * miss next time. */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const client = await redisReady();
  if (!client) return;

  try {
    await client.del(...keys);
  } catch {
    /* A failed invalidation is the one case where failing open has a cost:
     * the stale entry survives until its TTL. That's the reason every cached
     * value here carries a short one. */
  }
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGetJson<T>(key);
  if (hit !== null) return hit;

  const fresh = await loader();
  if (fresh !== null && fresh !== undefined) {
    await cacheSetJson(key, fresh, ttlSeconds);
  }
  return fresh;
}

export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  const client = await redisReady();
  if (!client) return null;

  try {
    const pipeline = client.multi();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds, "NX");
    const results = await pipeline.exec();
    const value = results?.[0]?.[1];
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}
export const formPublicKey = (formId: string) => redisKey("form", "v1", formId, "public");

export const formCountKey = (formId: string) => redisKey("form", "v1", formId, "count");

export const uploadStatusKey = (uploadId: string) => redisKey("upload", "v1", uploadId, "status");
