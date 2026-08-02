import "dotenv/config";
import { Queue, Worker, type ConnectionOptions, type JobsOptions, type Processor } from "bullmq";
import { blockingConnection, isRedisConfigured, redisEnv } from "@repo/redis";

import { env as queueEnv } from "./env";
import {
  QUEUE_ANALYTICS,
  QUEUE_UPLOADS,
  JOB_PROCESS_UPLOAD,
  JOB_RECORD_FIELD_ANSWERS,
  type FieldAnswer,
  type ProcessUploadJob,
  type RecordFieldAnswersJob,
} from "./jobs";

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
export const analyticsQueue = () => getQueue(QUEUE_ANALYTICS);

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

let answerBuffer: FieldAnswer[] = [];
let flushTimer: NodeJS.Timeout | null = null;

async function flushAnswerBuffer(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (answerBuffer.length === 0) return;
  const batch = answerBuffer;
  answerBuffer = [];

  try {
    await analyticsQueue().add(
      JOB_RECORD_FIELD_ANSWERS,
      { answers: batch } satisfies RecordFieldAnswersJob,
      {
        priority: 10,
        attempts: 2,
      },
    );
  } catch (err) {
    console.error(
      `[queue:analytics] dropped ${batch.length} field answer(s):`,
      err instanceof Error ? err.message : err,
    );
  }
}
export function enqueueFieldAnswer(answer: FieldAnswer): void {
  if (!isQueueAvailable()) return;

  answerBuffer.push(answer);

  if (answerBuffer.length >= queueEnv.ANALYTICS_BATCH_MAX) {
    void flushAnswerBuffer();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => void flushAnswerBuffer(), queueEnv.ANALYTICS_BATCH_MS);
    flushTimer.unref?.();
  }
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

export function createAnalyticsWorker(processor: Processor<RecordFieldAnswersJob>): Worker {
  return new Worker<RecordFieldAnswersJob>(QUEUE_ANALYTICS, processor, {
    connection: blockingConnection() as unknown as ConnectionOptions,
    prefix: bullPrefix,
    concurrency: queueEnv.ANALYTICS_WORKER_CONCURRENCY,
    lockDuration: 30_000,
    maxStalledCount: 2,
  });
}

export async function drainProducers(): Promise<void> {
  await flushAnswerBuffer();

  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  queues.clear();

  const connection = producerConnection as unknown as { quit?: () => Promise<unknown> } | null;
  producerConnection = null;
  if (connection?.quit) {
    await connection.quit().catch(() => {});
  }
}
