import type { Job } from "bullmq";
import { logger } from "@repo/logger";
import { queueEnv, type RecordFieldAnswersJob } from "@repo/queue";

import { analyticsService } from "../services";

export async function processFieldAnswers(job: Job<RecordFieldAnswersJob>): Promise<void> {
  const answers = job.data.answers ?? [];
  if (answers.length === 0) return;

  const written = await analyticsService.recordFieldAnswersBatch(
    answers,
    queueEnv.ANALYTICS_INSERT_CHUNK,
  );

  if (written < answers.length) {
    logger.warn(
      `[worker:analytics] wrote ${written}/${answers.length} field answers — ` +
        `the rest referenced forms or fields that no longer exist`,
    );
    return;
  }

  logger.debug(`[worker:analytics] wrote ${written} field answers`);
}
