export const QUEUE_UPLOADS = "uploads";

export const JOB_PROCESS_UPLOAD = "process-upload";

export interface ProcessUploadJob {
  uploadId: string;
  formId: string;
  storedPath: string;
  mimeType: string;
  originalName: string;
}
