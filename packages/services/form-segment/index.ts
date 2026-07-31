import { db, eq, and, isNull, max, count } from "@repo/database";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { formFieldsTable } from "@repo/database/models/form-field";
import { requireEditor } from "../form";
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

/** Title given to the segment that adopts questions written before the form
 *  was ever segmented. */
const DEFAULT_SEGMENT_TITLE = "Segment 1";

class FormSegmentService {
  /**
   * Add a segment to a form.
   *
   * The interesting case is the first one. Before any segment exists, a
   * form's questions all carry `segment_id = NULL`, which the renderer
   * treats as one implicit opening segment. If we simply inserted the new
   * segment, those questions would still be unassigned and the editor would
   * see an empty "Segment 2" next to a nameless pile of existing questions.
   *
   * So the first `createFormSegment` on a form does two things: materialise
   * "Segment 1" and adopt every loose question into it, then create the
   * segment that was actually asked for. That yields exactly the mental
   * model the editor has — segment 1 holds what I already wrote, segment 2
   * is the new empty one.
   *
   * Wrapped in a transaction because the intermediate state (a default
   * segment that exists but has adopted nothing) would strand questions in
   * an implicit segment that is no longer implicit. Partial application here
   * is worse than failure.
   */
  public async createFormSegment(payload: CreateFormSegmentInputType & { userId: string }) {
    const {
      formId,
      title,
      description,
      index: clientIndex,
      adoptUnassignedFields,
    } = await createFormSegmentInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    return db.transaction(async (tx) => {
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

      // Same rationale as `createFormField`: honour a client-supplied index
      // so a batch of new segments doesn't have every parallel call read the
      // same MAX(index) and collide on UNIQUE(form_id, index).
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

    // Optimistic-lock check — mirrors `updateFormField`. Surfaces a
    // recognisable conflict so the builder can reload rather than
    // silently overwrite a collaborator's edit.
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

    return { id: updated.id, version: updated.version };
  }

  /**
   * Delete a segment.
   *
   * Its questions are NOT deleted — they're moved to a neighbouring segment
   * first. Deleting a page in a form builder should never be a destructive
   * act on the work inside it; that surprise is unrecoverable, and an editor
   * who wants the questions gone can delete them deliberately.
   *
   * The questions are re-parented explicitly rather than left to the FK's ON
   * DELETE SET NULL. A NULL `segment_id` means "the implicit first segment",
   * which sorts ahead of every real one — so relying on the FK would teleport
   * the questions of a deleted middle segment to the very front of the form.
   * Adopting the nearest PRECEDING segment keeps them where the editor last
   * saw them. Deleting the first segment falls forward to the next one
   * instead, and deleting the only segment is the one case where NULL is
   * genuinely correct: the form goes back to being unsegmented.
   *
   * Branch rules that targeted this segment go away with it (ON DELETE
   * CASCADE on `target_segment_id`), because a rule pointing at a segment
   * that no longer exists would dead-end the respondent.
   */
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

    return db.transaction(async (tx) => {
      const siblings = await tx
        .select({ id: formSegmentsTable.id, index: formSegmentsTable.index })
        .from(formSegmentsTable)
        .where(eq(formSegmentsTable.formId, existing.formId))
        .orderBy(formSegmentsTable.index);

      const position = siblings.findIndex((s) => s.id === id);
      const previous = position > 0 ? siblings[position - 1] : undefined;
      const next = position >= 0 ? siblings[position + 1] : undefined;
      const adoptiveSegmentId = previous?.id ?? next?.id ?? null;

      // Counted before the move: afterwards nothing matches this segment id.
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

  /** Unauthenticated read used by the public form renderer. Access control
   *  is the caller's job — `getFormById` is already public. */
  public async listSegmentsForPublicForm(formId: string) {
    return db
      .select()
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.formId, formId))
      .orderBy(formSegmentsTable.index);
  }
}

export default FormSegmentService;
