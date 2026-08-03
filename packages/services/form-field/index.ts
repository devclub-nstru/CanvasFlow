import { db, eq, and, max } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { invalidateFormCache, requireEditor } from "../form";
import {
  createFormFieldInput,
  type CreateFormFieldInputType,
  updateFormFieldInput,
  type UpdateFormFieldInputType,
  deleteFormFieldInput,
  type DeleteFormFieldInputType,
  getFormFieldInput,
  type GetFormFieldInputType,
  listFormFieldsInput,
  type ListFormFieldsInputType,
} from "./model";

class FormFieldService {
  private async getNextIndex(formId: string): Promise<string> {
    const fields = await db
      .select({ maxIndex: max(formFieldsTable.index) })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));

    const current = fields[0]?.maxIndex;
    const next = current ? parseFloat(current) + 1 : 1;
    return next.toFixed(2);
  }

  private async assertSegmentBelongsToForm(
    formId: string,
    segmentId?: string | null,
  ): Promise<void> {
    if (!segmentId) return;

    const rows = await db
      .select({ formId: formSegmentsTable.formId })
      .from(formSegmentsTable)
      .where(eq(formSegmentsTable.id, segmentId));

    const segment = rows[0];
    if (!segment) throw new Error("Segment not found");
    if (segment.formId !== formId) {
      throw new Error("Segment belongs to a different form");
    }
  }

  public async createFormField(payload: CreateFormFieldInputType & { userId: string }) {
    const {
      formId,
      segmentId,
      label,
      placeholder,
      isRequired,
      index: clientIndex,
      type,
      options,
      description,
    } = await createFormFieldInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);
    await this.assertSegmentBelongsToForm(formId, segmentId);

    const labelKey =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "field";
    const index = clientIndex ?? (await this.getNextIndex(formId));

    const insertResult = await db
      .insert(formFieldsTable)
      .values({
        formId,
        segmentId: segmentId || null,
        label,
        labelKey,
        placeholder: placeholder || undefined,
        isRequired,
        index,
        type,
        options: options || undefined,
        description: description || undefined,
      })
      .returning({
        id: formFieldsTable.id,
      });

    if (!insertResult || insertResult.length === 0 || !insertResult[0]?.id) {
      throw new Error("Failed to create form field");
    }

    await invalidateFormCache(formId);

    return {
      id: insertResult[0].id,
      labelKey,
      index,
    };
  }

  public async updateFormField(payload: UpdateFormFieldInputType & { userId: string }) {
    const {
      id,
      segmentId,
      label,
      placeholder,
      isRequired,
      index,
      type,
      options,
      description,
      expectedVersion,
    } = await updateFormFieldInput.parseAsync(payload);

    const existingFieldResult = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.id, id));
    const existingField = existingFieldResult[0];
    if (!existingField) {
      throw new Error("Form field not found");
    }

    await requireEditor(existingField.formId, payload.userId);
    await this.assertSegmentBelongsToForm(existingField.formId, segmentId);

    if (expectedVersion !== undefined && existingField.version !== expectedVersion) {
      throw new Error(
        `Form field was modified by someone else (expected version ${expectedVersion}, got ${existingField.version}). Reload and try again.`,
      );
    }

    let newLabelKey: string | undefined = undefined;
    const currentLabel = label !== undefined ? label : existingField.label;
    const isCurrentlyUntitledKey =
      existingField.labelKey.startsWith("untitled") || existingField.labelKey === "field";
    const isNewCustomLabel =
      currentLabel !== "" && !currentLabel.toLowerCase().startsWith("untitled");

    if (isCurrentlyUntitledKey && isNewCustomLabel) {
      newLabelKey =
        currentLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "field";
    }

    const updateResult = await db
      .update(formFieldsTable)
      .set({
        ...(segmentId !== undefined ? { segmentId } : {}),
        ...(label !== undefined ? { label } : {}),
        ...(newLabelKey !== undefined ? { labelKey: newLabelKey } : {}),
        ...(placeholder !== undefined ? { placeholder } : {}),
        ...(isRequired !== undefined ? { isRequired } : {}),
        ...(index !== undefined ? { index } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(description !== undefined ? { description } : {}),
        version: existingField.version + 1,
      })
      .where(
        expectedVersion !== undefined
          ? and(eq(formFieldsTable.id, id), eq(formFieldsTable.version, expectedVersion))
          : eq(formFieldsTable.id, id),
      )
      .returning({
        id: formFieldsTable.id,
        version: formFieldsTable.version,
      });

    if (!updateResult || updateResult.length === 0 || !updateResult[0]?.id) {
      throw new Error("Update raced with another change — please retry");
    }

    await invalidateFormCache(existingField.formId);

    return {
      id: updateResult[0].id,
      version: updateResult[0].version,
    };
  }

  public async deleteFormField(payload: DeleteFormFieldInputType & { userId: string }) {
    const { id } = await deleteFormFieldInput.parseAsync(payload);

    const existingFieldResult = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.id, id));
    const existingField = existingFieldResult[0];
    if (!existingField) {
      throw new Error("Form field not found");
    }

    await requireEditor(existingField.formId, payload.userId);

    const deleteResult = await db
      .delete(formFieldsTable)
      .where(eq(formFieldsTable.id, id))
      .returning({
        id: formFieldsTable.id,
      });

    if (!deleteResult || deleteResult.length === 0 || !deleteResult[0]?.id) {
      throw new Error("Failed to delete form field or field not found");
    }

    await invalidateFormCache(existingField.formId);

    return {
      success: true,
    };
  }

  public async getFormField(payload: GetFormFieldInputType & { userId: string }) {
    const { id } = await getFormFieldInput.parseAsync(payload);

    const result = await db.select().from(formFieldsTable).where(eq(formFieldsTable.id, id));
    const field = result[0];

    if (!field) {
      throw new Error("Form field not found");
    }

    await requireEditor(field.formId, payload.userId);

    return field;
  }

  public async listFormFields(payload: ListFormFieldsInputType & { userId: string }) {
    const { formId } = await listFormFieldsInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    const result = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);

    return result;
  }
}

export default FormFieldService;
