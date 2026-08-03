import crypto from "node:crypto";
import { and, db, eq, inArray, sql } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formUploadsTable, type SubmittedFileValue } from "@repo/database/models/form-upload";
import { cacheDel, cacheGetJson, cacheSetJson, uploadStatusKey } from "@repo/redis/cache";

import {
  createPendingUploadInput,
  fileUploadFieldOptions,
  getUploadStatusInput,
  markFailedInput,
  markReadyInput,
  submittedUploadRef,
  UPLOAD_NOT_READY_ERROR,
  type CreatePendingUploadInputType,
  type FileUploadFieldOptions,
  type GetUploadStatusInputType,
  type MarkFailedInputType,
  type MarkReadyInputType,
  type UploadStatusOutputType,
} from "./model";

export * from "./model";

const STATUS_CACHE_TTL_SECONDS = 15 * 60;

function tokensMatch(supplied: string, actual: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

type CachedUploadSnapshot = UploadStatusOutputType & { tokenHash: string };

class FormUploadService {
  // Validate upload permissions
  public async assertUploadAllowed(payload: {
    formId: string;
    formFieldId: string;
  }): Promise<FileUploadFieldOptions> {
    const { formId, formFieldId } = payload;

    const rows = await db
      .select({
        isPublished: formsTable.isPublished,
        isOpen: formsTable.isOpen,
        expiresAt: formsTable.expiresAt,
        fieldType: formFieldsTable.type,
        fieldOptions: formFieldsTable.options,
      })
      .from(formFieldsTable)
      .innerJoin(formsTable, eq(formsTable.id, formFieldsTable.formId))
      .where(and(eq(formFieldsTable.id, formFieldId), eq(formFieldsTable.formId, formId)))
      .limit(1);

    const row = rows[0];
    if (!row) throw new Error("Upload target not found");

    if (row.fieldType !== "FILE_UPLOAD") {
      throw new Error("This question does not accept file uploads");
    }
    if (!row.isPublished) throw new Error("Form is not published yet");
    if (!row.isOpen) throw new Error("Form is closed for submissions");
    if (row.expiresAt && new Date() > new Date(row.expiresAt)) {
      throw new Error("Form has expired");
    }

    const parsed = fileUploadFieldOptions.safeParse(row.fieldOptions ?? {});
    return parsed.success ? parsed.data : {};
  }

  // Creates pending upload
  public async createPendingUpload(payload: CreatePendingUploadInputType) {
    const input = await createPendingUploadInput.parseAsync(payload);

    const claimToken = crypto.randomBytes(24).toString("base64url");

    const inserted = await db
      .insert(formUploadsTable)
      .values({
        formId: input.formId,
        formFieldId: input.formFieldId,
        claimToken,
        status: "pending",
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storedPath: input.storedPath,
      })
      .returning({ id: formUploadsTable.id });

    const row = inserted[0];
    if (!row) throw new Error("Failed to record upload");

    await this.publishStatus(
      {
        uploadId: row.id,
        status: "pending",
        name: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        url: null,
        error: null,
      },
      claimToken,
    );

    return { uploadId: row.id, claimToken, status: "pending" as const };
  }

  private async publishStatus(snapshot: UploadStatusOutputType, claimToken: string): Promise<void> {
    const entry: CachedUploadSnapshot = { ...snapshot, tokenHash: hashToken(claimToken) };
    await cacheSetJson(uploadStatusKey(snapshot.uploadId), entry, STATUS_CACHE_TTL_SECONDS);
  }

  // Retrieve upload status
  public async getUploadStatus(payload: GetUploadStatusInputType): Promise<UploadStatusOutputType> {
    const { uploadId, claimToken } = await getUploadStatusInput.parseAsync(payload);

    const cachedSnapshot = await cacheGetJson<CachedUploadSnapshot>(uploadStatusKey(uploadId));

    if (cachedSnapshot?.tokenHash) {
      if (!tokensMatch(hashToken(claimToken), cachedSnapshot.tokenHash)) {
        throw new Error("Upload not found");
      }
      const { tokenHash: _tokenHash, ...visible } = cachedSnapshot;
      return { ...visible, uploadId };
    }

    const rows = await db
      .select({
        claimToken: formUploadsTable.claimToken,
        status: formUploadsTable.status,
        originalName: formUploadsTable.originalName,
        mimeType: formUploadsTable.mimeType,
        sizeBytes: formUploadsTable.sizeBytes,
        cloudinaryUrl: formUploadsTable.cloudinaryUrl,
        error: formUploadsTable.error,
      })
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, uploadId))
      .limit(1);

    const row = rows[0];
    if (!row || !tokensMatch(claimToken, row.claimToken)) {
      throw new Error("Upload not found");
    }

    const snapshot: UploadStatusOutputType = {
      uploadId,
      status: row.status,
      name: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      url: row.cloudinaryUrl,
      error: row.error,
    };

    await this.publishStatus(snapshot, row.claimToken);

    return snapshot;
  }

  // Mark upload as processing
  public async markProcessing(uploadId: string) {
    const updated = await db
      .update(formUploadsTable)
      .set({ status: "processing", attempts: sql`${formUploadsTable.attempts} + 1` })
      .where(
        and(
          eq(formUploadsTable.id, uploadId),
          inArray(formUploadsTable.status, ["pending", "processing"]),
        ),
      )
      .returning({
        id: formUploadsTable.id,
        formId: formUploadsTable.formId,
        storedPath: formUploadsTable.storedPath,
        originalName: formUploadsTable.originalName,
        mimeType: formUploadsTable.mimeType,
        sizeBytes: formUploadsTable.sizeBytes,
        attempts: formUploadsTable.attempts,
        claimToken: formUploadsTable.claimToken,
      });

    const row = updated[0];
    if (!row) return null;

    await this.publishStatus(
      {
        uploadId: row.id,
        status: "processing",
        name: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        url: null,
        error: null,
      },
      row.claimToken,
    );

    return row;
  }

  // Mark upload as ready
  public async markReady(payload: MarkReadyInputType) {
    const input = await markReadyInput.parseAsync(payload);

    const updated = await db
      .update(formUploadsTable)
      .set({
        status: "ready",
        cloudinaryPublicId: input.cloudinaryPublicId,
        cloudinaryUrl: input.cloudinaryUrl,
        cloudinaryResourceType: input.cloudinaryResourceType,
        storedPath: null,
        error: null,
      })
      .where(eq(formUploadsTable.id, input.uploadId))
      .returning({
        id: formUploadsTable.id,
        originalName: formUploadsTable.originalName,
        mimeType: formUploadsTable.mimeType,
        sizeBytes: formUploadsTable.sizeBytes,
        claimToken: formUploadsTable.claimToken,
      });

    const row = updated[0];
    if (!row) return null;

    await this.publishStatus(
      {
        uploadId: row.id,
        status: "ready",
        name: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        url: input.cloudinaryUrl,
        error: null,
      },
      row.claimToken,
    );

    return row;
  }

  // Mark upload as failed
  public async markFailed(payload: MarkFailedInputType) {
    const input = await markFailedInput.parseAsync(payload);

    const updated = await db
      .update(formUploadsTable)
      .set({ status: "failed", error: input.error })
      .where(eq(formUploadsTable.id, input.uploadId))
      .returning({
        id: formUploadsTable.id,
        originalName: formUploadsTable.originalName,
        mimeType: formUploadsTable.mimeType,
        sizeBytes: formUploadsTable.sizeBytes,
        claimToken: formUploadsTable.claimToken,
      });

    const row = updated[0];
    if (!row) return null;

    await this.publishStatus(
      {
        uploadId: row.id,
        status: "failed",
        name: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        url: null,
        error: input.error,
      },
      row.claimToken,
    );

    return row;
  }

  // Claim uploads for submission
  public async claimUploadsForSubmission(payload: {
    formId: string;
    formFieldId: string;
    submissionId: string;
    refs: unknown;
  }): Promise<SubmittedFileValue[]> {
    const { formId, formFieldId, submissionId } = payload;

    const rawList = Array.isArray(payload.refs) ? payload.refs : [payload.refs];

    const refs = rawList
      .map((entry) => submittedUploadRef.safeParse(entry))
      .flatMap((result) => (result.success ? [result.data] : []));

    if (refs.length === 0) return [];

    const byId = new Map(refs.map((ref) => [ref.uploadId, ref]));

    const rows = await db
      .select({
        id: formUploadsTable.id,
        claimToken: formUploadsTable.claimToken,
        status: formUploadsTable.status,
        originalName: formUploadsTable.originalName,
        mimeType: formUploadsTable.mimeType,
        sizeBytes: formUploadsTable.sizeBytes,
        cloudinaryUrl: formUploadsTable.cloudinaryUrl,
        submissionId: formUploadsTable.submissionId,
      })
      .from(formUploadsTable)
      .where(
        and(
          inArray(formUploadsTable.id, [...byId.keys()]),
          eq(formUploadsTable.formId, formId),
          eq(formUploadsTable.formFieldId, formFieldId),
        ),
      );

    const claimed: SubmittedFileValue[] = [];
    const idsToAttach: string[] = [];

    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (const ref of refs) {
      const row = rowById.get(ref.uploadId);
      if (!row) continue;
      if (!tokensMatch(ref.claimToken, row.claimToken)) continue;
      if (row.submissionId && row.submissionId !== submissionId) continue;
      if (idsToAttach.includes(row.id)) continue;

      idsToAttach.push(row.id);
      claimed.push({
        uploadId: row.id,
        name: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        url: row.cloudinaryUrl,
        status: row.status,
      });
    }

    if (idsToAttach.length > 0) {
      await db
        .update(formUploadsTable)
        .set({ submissionId })
        .where(inArray(formUploadsTable.id, idsToAttach));

      await cacheDel(...idsToAttach.map((id) => uploadStatusKey(id)));
    }

    return claimed;
  }

  // Find abandoned uploads
  public async findAbandonedUploads(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);

    return db
      .select({
        id: formUploadsTable.id,
        storedPath: formUploadsTable.storedPath,
        cloudinaryPublicId: formUploadsTable.cloudinaryPublicId,
        cloudinaryResourceType: formUploadsTable.cloudinaryResourceType,
      })
      .from(formUploadsTable)
      .where(
        and(
          sql`${formUploadsTable.submissionId} IS NULL`,
          sql`${formUploadsTable.createdAt} < ${cutoff}`,
        ),
      )
      .limit(1_000);
  }
}

export { UPLOAD_NOT_READY_ERROR };
export default FormUploadService;
