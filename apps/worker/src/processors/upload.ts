import fsp from "node:fs/promises";
import type { Job } from "bullmq";
import { logger } from "@repo/logger";
import type { ProcessUploadJob } from "@repo/queue";

import { formUploadService } from "../services";
import { PermanentStorageError, type FileStorage } from "../storage";

export function createUploadProcessor(storage: FileStorage) {
  return async function processUpload(job: Job<ProcessUploadJob>): Promise<void> {
    const { uploadId } = job.data;

    const row = await formUploadService.markProcessing(uploadId);

    if (!row) {
      logger.info(`[worker:upload] ${uploadId} is no longer claimable, skipping`);
      return;
    }

    if (!row.storedPath) {
      await formUploadService.markFailed({
        uploadId,
        error: "Temporary file path is missing",
      });
      return;
    }

    try {
      const stored = await storage.upload({
        localPath: row.storedPath,
        formId: row.formId,
        uploadId,
        originalName: row.originalName,
        mimeType: row.mimeType,
      });

      await formUploadService.markReady({
        uploadId,
        cloudinaryPublicId: stored.publicId,
        cloudinaryUrl: stored.url,
        cloudinaryResourceType: stored.resourceType,
      });

      try {
        await fsp.unlink(row.storedPath);
      } catch {
        // Ignore unlinking errors
      }

      logger.info(`[worker:upload] ${uploadId} stored as ${stored.publicId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";

      if (err instanceof PermanentStorageError) {
        logger.error(`[worker:upload] ${uploadId} permanently failed: ${message}`);
        await formUploadService.markFailed({ uploadId, error: message });
        return;
      }

      const attemptsMade = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;

      logger.warn(
        `[worker:upload] ${uploadId} attempt ${attemptsMade}/${maxAttempts} failed: ${message}`,
      );

      if (attemptsMade >= maxAttempts) {
        await formUploadService.markFailed({ uploadId, error: message });
      }

      throw err;
    }
  };
}
