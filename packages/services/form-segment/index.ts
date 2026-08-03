import { db, eq, and, isNull, max, count } from "@repo/database";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { formFieldsTable } from "@repo/database/models/form-field";
import { invalidateFormCache, requireEditor } from "../form";
import {
  createFormSegmentInput,
  type CreateFormSegmentInputType,
  updateFormSegmentInput,
  type UpdateFormSegmentInputType,
  deleteFormSegmentInput,
  type DeleteFormSegmentInputType,
  listFormSegmentsInput,
  type ListFormSegmentsInputType,
} from "./model";

const DEFAULT_SEGMENT_TITLE = "Segment 1";

class FormSegmentService {
  // Creates a form segment
  public async createFormSegment(payload: CreateFormSegmentInputType & { userId: string }) {
    const {
      formId,
      title,
      description,
      index: clientIndex,
      adoptUnassignedFields,
    } = await createFormSegmentInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ value: count() })
        .from(formSegmentsTable)
        .where(eq(formSegmentsTable.formId, formId));
      const segmentCount = Number(existing[0]?.value ?? 0);

      let createdDefaultSegment: typeof formSegmentsTable.$inferSelect | null = null;

      if (segmentCount === 0 && adoptUnassignedFields) {
        const defaultRows = await tx
          .insert(formSegmentsTable)
          .values({
            formId,
            title: DEFAULT_SEGMENT_TITLE,
            index: "1",
          })
          .returning();

        createdDefaultSegment = defaultRows[0] ?? null;
        if (!createdDefaultSegment) {
          throw new Error("Failed to create the default segment");
        }

        await tx
          .update(formFieldsTable)
          .set({ segmentId: createdDefaultSegment.id })
          .where(and(eq(formFieldsTable.formId, formId), isNull(formFieldsTable.segmentId)));
      }

      let index = clientIndex;
      if (index === undefined) {
        const rows = await tx
          .select({ maxIndex: max(formSegmentsTable.index) })
          .from(formSegmentsTable)
          .where(eq(formSegmentsTable.formId, formId));
        const current = rows[0]?.maxIndex;
        index = String(current ? parseFloat(current) + 1 : 1);
      }

      const insertResult = await tx
        .insert(formSegmentsTable)
        .values({
          formId,
          title,
          description: description || undefined,
          index,
        })
        .returning({ id: formSegmentsTable.id, index: formSegmentsTable.index });

      const created = insertResult[0];
      if (!created?.id) {
        throw new Error("Failed to create form segment");
      }

      return {
        id: created.id,
        index: created.index,
        createdDefaultSegment,
      };
    });

    await invalidateFormCache(formId);

    return result;
  }

  public async updateFormSegment(payload: UpdateFormSegmentInputType & { userId: string }) {
    const { id, title, description, index, expectedVersion } =
      await updateFormSegmentInput.parseAsync(payload);

    const existingResult = await db
      .select()
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.id, id));
    const existing = existingResult[0];
    if (!existing) {
      throw new Error("Form segment not found");
    }

    await requireEditor(existing.formId, payload.userId);

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error(
        `Form segment was modified by someone else (expected version ${expectedVersion}, got ${existing.version}). Reload and try again.`,
      );
    }

    const updateResult = await db
      .update(formSegmentsTable)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(index !== undefined ? { index } : {}),
        version: existing.version + 1,
      })
      .where(
        expectedVersion !== undefined
          ? and(eq(formSegmentsTable.id, id), eq(formSegmentsTable.version, expectedVersion))
          : eq(formSegmentsTable.id, id),
      )
      .returning({ id: formSegmentsTable.id, version: formSegmentsTable.version });

    const updated = updateResult[0];
    if (!updated?.id) {
      throw new Error("Update raced with another change — please retry");
    }

    await invalidateFormCache(existing.formId);

    return { id: updated.id, version: updated.version };
  }

  // Delete segment and move its questions
  public async deleteFormSegment(payload: DeleteFormSegmentInputType & { userId: string }) {
    const { id } = await deleteFormSegmentInput.parseAsync(payload);

    const existingResult = await db
      .select()
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.id, id));
    const existing = existingResult[0];
    if (!existing) {
      throw new Error("Form segment not found");
    }

    await requireEditor(existing.formId, payload.userId);

    const result = await db.transaction(async (tx) => {
      const siblings = await tx
        .select({ id: formSegmentsTable.id, index: formSegmentsTable.index })
        .from(formSegmentsTable)
        .where(eq(formSegmentsTable.formId, existing.formId))
        .orderBy(formSegmentsTable.index);

      const position = siblings.findIndex((s) => s.id === id);
      const previous = position > 0 ? siblings[position - 1] : undefined;
      const next = position >= 0 ? siblings[position + 1] : undefined;
      const adoptiveSegmentId = previous?.id ?? next?.id ?? null;

      const affected = await tx
        .select({ value: count() })
        .from(formFieldsTable)
        .where(eq(formFieldsTable.segmentId, id));
      const releasedFieldCount = Number(affected[0]?.value ?? 0);

      if (releasedFieldCount > 0) {
        await tx
          .update(formFieldsTable)
          .set({ segmentId: adoptiveSegmentId })
          .where(eq(formFieldsTable.segmentId, id));
      }

      const deleteResult = await tx
        .delete(formSegmentsTable)
        .where(eq(formSegmentsTable.id, id))
        .returning({ id: formSegmentsTable.id });

      if (!deleteResult[0]?.id) {
        throw new Error("Failed to delete form segment or segment not found");
      }

      return { success: true, releasedFieldCount };
    });

    await invalidateFormCache(existing.formId);

    return result;
  }

  public async listFormSegments(payload: ListFormSegmentsInputType & { userId: string }) {
    const { formId } = await listFormSegmentsInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    return db
      .select()
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.formId, formId))
      .orderBy(formSegmentsTable.index);
  }

  // List segments for public form
  public async listSegmentsForPublicForm(formId: string) {
    return db
      .select()
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.formId, formId))
      .orderBy(formSegmentsTable.index);
  }
}

export default FormSegmentService;
