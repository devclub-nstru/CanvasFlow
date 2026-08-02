export const QUEUE_UPLOADS = "uploads";
export const QUEUE_ANALYTICS = "analytics";

export const JOB_PROCESS_UPLOAD = "process-upload";
export const JOB_RECORD_FIELD_ANSWERS = "record-field-answers";

export interface ProcessUploadJob {
  uploadId: string;
  formId: string;
  storedPath: string;
  mimeType: string;
  originalName: string;
}

export interface FieldAnswer {
  formId: string;
  fieldId: string;
  value: unknown;
}

export interface RecordFieldAnswersJob {
  answers: FieldAnswer[];
}
