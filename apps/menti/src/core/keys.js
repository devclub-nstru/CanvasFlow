import { redisKey } from "./env/env.js";

/* Redis keys and channels shared between the API process and the PPTX worker.
 * They live here so a producer and its consumer cannot drift apart, and they go
 * through redisKey() so this service can share one Redis instance with the rest
 * of the monorepo without colliding with the API's cache or BullMQ queues. */

export const PPTX_JOB_QUEUE = redisKey("queue", "pptx-import");
export const IMPORT_PROGRESS_CHANNEL = redisKey("channel", "import-progress");
