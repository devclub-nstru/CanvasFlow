import { Queue } from "bullmq";
import Redis from "ioredis";

import env, { redisKey } from "../env/env.js";
import { logger } from "../logger/logger.js";


export const PPTX_QUEUE_NAME = "pptx-import";

export const PPTX_QUEUE_PREFIX = redisKey("bull");

export const PPTX_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 15_000 },

  removeOnComplete: { age: 24 * 3600, count: 200 },
  removeOnFail: { age: 14 * 24 * 3600 },
};

export function createQueueConnection(role) {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });

  client.on("error", (err) => logger.error(`redis error (${role}):`, err.message));

  return client;
}

let queue = null;

/* Lazily built so importing this module does not open a connection in a
 * process that never enqueues anything. */
function getQueue() {
  if (queue) return queue;

  queue = new Queue(PPTX_QUEUE_NAME, {
    connection: createQueueConnection("pptx-queue"),
    prefix: PPTX_QUEUE_PREFIX,
    defaultJobOptions: PPTX_JOB_OPTIONS,
  });

  queue.on("error", (err) => logger.error("pptx queue error:", err.message));

  return queue;
}

export async function enqueuePptxImport(importId) {
  const id = String(importId);

  return getQueue().add(
    "convert",
    { importId: id },
    { ...PPTX_JOB_OPTIONS, jobId: id },
  );
}

export async function closePptxQueue() {
  if (!queue) return;
  try {
    await queue.close();
  } catch (err) {
    logger.error("failed to close pptx queue:", err?.message);
  }
  queue = null;
}
