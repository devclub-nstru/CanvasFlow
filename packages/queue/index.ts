import "dotenv/config";
import { Queue, Worker, type ConnectionOptions, type Processor } from "bullmq";
import { blockingConnection, isRedisConfigured, redisEnv } from "@repo/redis";

import { env as queueEnv } from "./env";
import { QUEUE_UPLOADS, JOB_PROCESS_UPLOAD, type ProcessUploadJob } from "./jobs";

export * from "./jobs";
export { queueEnv };

export function isQueueAvailable(): boolean {
  return isRedisConfigured();
}

let producerConnection: ConnectionOptions | null = null;
function getProducerConnection(): ConnectionOptions {
  if (!producerConnection) {
    producerConnection = blockingConnection() as unknown as ConnectionOptions;
  }
  return producerConnection;
}

const bullPrefix = `${redisEnv.REDIS_PREFIX}:bull`;

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getProducerConnection(),
    prefix: bullPrefix,
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 10_000, age: 7 * 24 * 3_600 },
    },
  });

  queue.on("error", (err) => {
    console.error(`[queue:${name}] error:`, err.message);
  });

  queues.set(name, queue);
  return queue;
}

export const uploadsQueue = () => getQueue(QUEUE_UPLOADS);

/* ── Producers ─────────────────────────────────────────────────────────── */

export async function enqueueUpload(payload: ProcessUploadJob): Promise<void> {
  if (!isQueueAvailable()) {
    throw new Error("Upload queue unavailable — REDIS_URL is not configured");
  }

  await uploadsQueue().add(JOB_PROCESS_UPLOAD, payload, {
    jobId: payload.uploadId,
    priority: 1,
  });
}

export function createUploadWorker(processor: Processor<ProcessUploadJob>): Worker {
  return new Worker<ProcessUploadJob>(QUEUE_UPLOADS, processor, {
    connection: blockingConnection() as unknown as ConnectionOptions,
    prefix: bullPrefix,
    concurrency: queueEnv.UPLOAD_WORKER_CONCURRENCY,

    lockDuration: 60_000,
    maxStalledCount: 2,
  });
}

export async function drainProducers(): Promise<void> {
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  queues.clear();

  const connection = producerConnection as unknown as { quit?: () => Promise<unknown> } | null;
  producerConnection = null;
  if (connection?.quit) {
    await connection.quit().catch(() => {});
  }
}
