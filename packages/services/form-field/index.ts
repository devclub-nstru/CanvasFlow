import { db, eq, and, max } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";
import { requireEditor } from "../form";
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

  public async createFormField(payload: CreateFormFieldInputType & { userId: string }) {
    const {
      formId,
      label,
      placeholder,
      isRequired,
      index: clientIndex,
      type,
      options,
      description,
    } = await createFormFieldInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    const labelKey =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "field";

    // Honor the client-supplied index when present. The client knows
    // the order of any batch of new fields it's about to send and ships
    // unique values; this avoids a race when `handleSave` fires multiple
    // creates via Promise.all (each parallel call would otherwise read
    // the same MAX(index) and collide on the unique (form_id, index)
    // constraint). Fall back to server-computed next index when the
    // caller doesn't supply one.
    const index = clientIndex ?? (await this.getNextIndex(formId));

    const insertResult = await db
      .insert(formFieldsTable)
      .values({
        formId,
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

    return {
      id: insertResult[0].id,
      labelKey,
      index,
    };
  }

  public async updateFormField(payload: UpdateFormFieldInputType & { userId: string }) {
    const {
      id,
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

    // Optimistic-lock check — if the caller supplied an expected version
    // and the row has since moved past it, another client wrote first.
    // We surface a recognisable conflict so the caller can resolve.
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

    // Conditional update — set the new values AND bump the version, but
    // only where the version still matches what the client expected.
    // Returning 0 rows here means another writer raced us; we surface a
    // conflict so the caller can refetch.
    const updateResult = await db
      .update(formFieldsTable)
      .set({
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
      // Either the row vanished (deleted concurrently) or the version
      // didn't match (someone else wrote between our read and write).
      throw new Error("Update raced with another change — please retry");
    }

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
