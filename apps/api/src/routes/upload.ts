import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import express, { type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";

import { logger } from "@repo/logger";
import { enqueueUpload, isQueueAvailable } from "@repo/queue";
import { storageKindFor } from "@repo/services/form-upload";
import { formUploadService } from "@repo/trpc/server/services";

import { env } from "../env";
import { leakyBucketRateLimiter } from "../lib/rate-limiter";

export const uploadRouter: express.Router = express.Router();

const TMP_DIR = env.UPLOAD_TMP_DIR?.trim() || path.join(os.tmpdir(), "canvasflow-uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });
logger.info(`[upload] temp directory: ${TMP_DIR}`);

const MAX_BYTES = Math.floor(env.UPLOAD_MAX_MB * 1024 * 1024);

const DEFAULT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/json",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);

function matchesAcceptEntry(mimeType: string, fileName: string, entry: string): boolean {
  const rule = entry.trim().toLowerCase();
  if (!rule) return false;

  if (rule.startsWith(".")) return fileName.toLowerCase().endsWith(rule);
  if (rule.endsWith("/*")) return mimeType.startsWith(rule.slice(0, -1));
  return mimeType === rule;
}

function safeExtension(originalName: string): string {
  const raw = path.extname(originalName).slice(1).toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]/g, "").slice(0, 10);
  return cleaned ? `.${cleaned}` : "";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${safeExtension(file.originalname)}`);
  },
});

interface UploadLocals {
  accept?: string[];
  maxMb?: number;
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
    fields: 4,
    parts: 8,
  },
  fileFilter: (req, file, cb) => {
    const locals = (req as Request & { uploadRules?: UploadLocals }).uploadRules ?? {};
    const mimeType = (file.mimetype || "").toLowerCase();

    if (!DEFAULT_ALLOWED_MIME.has(mimeType)) {
      return cb(new MulterError("LIMIT_UNEXPECTED_FILE", `Unsupported file type: ${mimeType}`));
    }

    if (locals.accept && locals.accept.length > 0) {
      const permitted = locals.accept.some((entry) =>
        matchesAcceptEntry(mimeType, file.originalname, entry),
      );
      if (!permitted) {
        return cb(
          new MulterError("LIMIT_UNEXPECTED_FILE", "This question doesn't accept that file type"),
        );
      }
    }

    return cb(null, true);
  },
});

const uploadLimiter = leakyBucketRateLimiter({
  bucketName: "upload",
  max: env.RATE_LIMIT_UPLOAD_MAX,
  windowMs: 60_000,
  message: { error: "Too many uploads — wait a minute and try again." },
});

async function discard(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {
    /* Already gone, or never written. Either way there is nothing to clean up
     * and nothing worth failing the request over. */
  }
}

async function preflight(req: Request, res: Response, next: NextFunction) {
  const { formId, fieldId } = req.params as { formId?: string; fieldId?: string };

  if (!formId || !fieldId) {
    return res.status(400).json({ error: "Missing form or field id" });
  }

  if (!isQueueAvailable()) {
    return res.status(503).json({
      error: "File uploads are temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const rules = await formUploadService.assertUploadAllowed({
      formId,
      formFieldId: fieldId,
    });

    (req as Request & { uploadRules?: UploadLocals }).uploadRules = {
      ...(rules.accept ? { accept: rules.accept } : {}),
      ...(rules.maxMb ? { maxMb: Math.min(rules.maxMb, env.UPLOAD_MAX_MB) } : {}),
    };

    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload not allowed";
    const status = message === "Upload target not found" ? 404 : 403;
    return res.status(status).json({ error: message });
  }
}

uploadRouter.post(
  "/uploads/:formId/:fieldId",
  uploadLimiter,
  preflight,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const { formId, fieldId } = req.params as { formId: string; fieldId: string };
    const rules = (req as Request & { uploadRules?: UploadLocals }).uploadRules ?? {};
    const kind = storageKindFor(file.mimetype);
    const providerCapMb =
      kind === "image"
        ? env.UPLOAD_MAX_MB_IMAGE
        : kind === "video"
          ? env.UPLOAD_MAX_MB_VIDEO
          : env.UPLOAD_MAX_MB_RAW;

    const effectiveMb = Math.min(rules.maxMb ?? env.UPLOAD_MAX_MB, providerCapMb);

    if (file.size > effectiveMb * 1024 * 1024) {
      await discard(file.path);

      const actualMb = (file.size / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        error:
          `That file is ${actualMb}MB, which is over the ${effectiveMb}MB limit for ` +
          `${kind === "raw" ? "documents" : kind === "image" ? "images" : "audio and video"}.`,
      });
    }

    let uploadId: string | undefined;

    try {
      const created = await formUploadService.createPendingUpload({
        formId,
        formFieldId: fieldId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storedPath: file.path,
      });
      uploadId = created.uploadId;

      await enqueueUpload({
        uploadId: created.uploadId,
        formId,
        storedPath: file.path,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });

      return res.status(202).json({
        uploadId: created.uploadId,
        claimToken: created.claimToken,
        status: created.status,
        name: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });
    } catch (err) {
      logger.error("[upload] failed to accept file", {
        err: err instanceof Error ? err.message : err,
        formId,
        fieldId,
        uploadId,
      });

      if (uploadId) {
        await formUploadService
          .markFailed({ uploadId, error: "Could not be queued for processing" })
          .catch(() => {});
      }

      await discard(file.path);

      return res.status(503).json({
        error: "Could not accept the file right now. Please try again.",
      });
    }
  },
);

uploadRouter.get("/uploads/limits", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json({
    maxMb: env.UPLOAD_MAX_MB,
    image: Math.min(env.UPLOAD_MAX_MB_IMAGE, env.UPLOAD_MAX_MB),
    video: Math.min(env.UPLOAD_MAX_MB_VIDEO, env.UPLOAD_MAX_MB),
    raw: Math.min(env.UPLOAD_MAX_MB_RAW, env.UPLOAD_MAX_MB),
  });
});

uploadRouter.get("/uploads/:uploadId", async (req: Request, res: Response) => {
  const { uploadId } = req.params as { uploadId: string };
  const headerToken = req.header("x-upload-token");

  if (!headerToken) {
    return res.status(401).json({ error: "Missing upload token" });
  }

  try {
    const status = await formUploadService.getUploadStatus({
      uploadId,
      claimToken: headerToken,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json(status);
  } catch {
    return res.status(404).json({ error: "Upload not found" });
  }
});

export function uploadErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (!(err instanceof MulterError)) {
    _next(err);
    return;
  }
  void discard((req.file as { path?: string } | undefined)?.path);

  if (err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      error: `That file is too large. The maximum size is ${env.UPLOAD_MAX_MB}MB.`,
    });
    return;
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    res.status(415).json({ error: err.field || "Unsupported file type" });
    return;
  }

  res.status(400).json({ error: "Upload rejected" });
}
