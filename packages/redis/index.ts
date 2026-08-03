import "dotenv/config";
import Redis, { type RedisOptions } from "ioredis";

import { env } from "./env";

export { env as redisEnv };

export function isRedisConfigured(): boolean {
  return !!env.REDIS_URL;
}

export function redisKey(...parts: (string | number)[]): string {
  return [env.REDIS_PREFIX, ...parts].join(":");
}

function baseOptions(): RedisOptions {
  return {
    retryStrategy: (times) => Math.min(times * 200, 2_000),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,

    lazyConnect: true,
  };
}

let client: Redis | null = null;
export function redis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, baseOptions());

  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  void client.connect().catch(() => {});

  return client;
}

export async function redisReady(timeoutMs = 2_000): Promise<Redis | null> {
  const connection = redis();
  if (!connection) return null;
  if (connection.status === "ready") return connection;

  if (connection.status === "wait") {
    try {
      await connection.connect();
      return connection;
    } catch {
      return null;
    }
  }

  return new Promise<Redis | null>((resolve) => {
    const settle = (value: Redis | null) => {
      clearTimeout(timer);
      connection.off("ready", onReady);
      connection.off("error", onError);
      resolve(value);
    };

    const onReady = () => settle(connection);
    const onError = () => settle(null);
    const timer = setTimeout(() => settle(null), timeoutMs);

    connection.once("ready", onReady);
    connection.once("error", onError);
  });
}

export function blockingConnection(): Redis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not set — the upload queue needs Redis");
  }

  const connection = new Redis(env.REDIS_URL, {
    ...baseOptions(),
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: false,
  });

  connection.on("error", (err) => {
    console.error("[redis:queue] connection error:", err.message);
  });

  return connection;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  const closing = client;
  client = null;
  try {
    await closing.quit();
  } catch {
    closing.disconnect();
  }
}

export type { Redis };
