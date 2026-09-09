import { redisKey } from "./env/env.js";
export const PPTX_JOB_QUEUE = redisKey("queue", "pptx-import");
export const IMPORT_PROGRESS_CHANNEL = redisKey("channel", "import-progress");
