import { z } from "zod";

export const fileUploadFieldOptions = z.object({
  accept: z.array(z.string().trim().max(100)).max(50).optional(),
  maxMb: z.coerce.number().positive().max(1_024).optional(),
  maxFiles: z.coerce.number().int().min(1).max(20).optional(),
});
export type FileUploadFieldOptions = z.infer<typeof fileUploadFieldOptions>;

export const createPendingUploadInput = z.object({
  formId: z.string().uuid().describe("Form the file is being uploaded to"),
  formFieldId: z.string().uuid().describe("The FILE_UPLOAD question being answered"),
  originalName: z.string().trim().min(1).max(255).describe("Filename as supplied by the browser"),
  mimeType: z.string().trim().min(1).max(127).describe("Detected content type"),
  sizeBytes: z.number().int().nonnegative().describe("Bytes actually written to disk"),
  storedPath: z.string().min(1).describe("Absolute path of the temp file multer wrote"),
});
export type CreatePendingUploadInputType = z.infer<typeof createPendingUploadInput>;

export const createPendingUploadOutput = z.object({
  uploadId: z.string().uuid(),
  claimToken: z.string(),
  status: z.enum(["pending", "processing", "ready", "failed"]),
});

export const getUploadStatusInput = z.object({
  uploadId: z.string().uuid(),
  claimToken: z.string().trim().min(1).max(64),
});
export type GetUploadStatusInputType = z.infer<typeof getUploadStatusInput>;

export const uploadStatusOutput = z.object({
  uploadId: z.string().uuid(),
  status: z.enum(["pending", "processing", "ready", "failed"]),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  url: z.string().nullable(),
  error: z.string().nullable(),
});
export type UploadStatusOutputType = z.infer<typeof uploadStatusOutput>;

export const markReadyInput = z.object({
  uploadId: z.string().uuid(),
  cloudinaryPublicId: z.string().min(1),
  cloudinaryUrl: z.string().min(1),
  cloudinaryResourceType: z.string().min(1).max(32),
});
export type MarkReadyInputType = z.infer<typeof markReadyInput>;

export const markFailedInput = z.object({
  uploadId: z.string().uuid(),
  error: z.string().max(2_000),
});
export type MarkFailedInputType = z.infer<typeof markFailedInput>;

export const submittedUploadRef = z.object({
  uploadId: z.string().uuid(),
  claimToken: z.string().trim().min(1).max(64),
});
export type SubmittedUploadRefType = z.infer<typeof submittedUploadRef>;

export const UPLOAD_NOT_READY_ERROR = "UPLOAD_NOT_READY";

export type StorageKind = "image" | "video" | "raw";

export function storageKindFor(mimeType: string): StorageKind {
  const type = mimeType.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/") || type.startsWith("audio/")) return "video";
  return "raw";
}
