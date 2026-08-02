import { db, eq, and } from "@repo/database";
import { formDraftsTable } from "@repo/database/models/form-draft";
import { formsTable } from "@repo/database/models/form";
import {
  saveDraftInput,
  type SaveDraftInputType,
  getDraftInput,
  type GetDraftInputType,
  deleteDraftInput,
  type DeleteDraftInputType,
} from "./model";

class FormDraftService {
  // Saves or updates draft
  public async saveDraft(payload: SaveDraftInputType & { userId: string }) {
    const { formId, values, pagePath } = await saveDraftInput.parseAsync(payload);
    const { userId } = payload;

    const formRows = await db
      .select({ id: formsTable.id, isPublished: formsTable.isPublished })
      .from(formsTable)
      .where(eq(formsTable.id, formId));

    const form = formRows[0];
    if (!form) throw new Error("Form not found");
    if (!form.isPublished) throw new Error("Form is not published yet");

    const rows = await db
      .insert(formDraftsTable)
      .values({ formId, userId, values, pagePath: pagePath ?? null })
      .onConflictDoUpdate({
        target: [formDraftsTable.formId, formDraftsTable.userId],
        set: { values, pagePath: pagePath ?? null, updatedAt: new Date() },
      })
      .returning({ id: formDraftsTable.id, updatedAt: formDraftsTable.updatedAt });

    const saved = rows[0];
    if (!saved) throw new Error("Failed to save draft");

    return { id: saved.id, updatedAt: saved.updatedAt.toISOString() };
  }

  public async getDraft(payload: GetDraftInputType & { userId: string }) {
    const { formId } = await getDraftInput.parseAsync(payload);
    const { userId } = payload;

    const rows = await db
      .select({
        values: formDraftsTable.values,
        pagePath: formDraftsTable.pagePath,
        updatedAt: formDraftsTable.updatedAt,
      })
      .from(formDraftsTable)
      .where(and(eq(formDraftsTable.formId, formId), eq(formDraftsTable.userId, userId)));

    const draft = rows[0];
    if (!draft) return null;

    return {
      values: (draft.values ?? {}) as Record<string, unknown>,
      pagePath: (draft.pagePath as number[] | null) ?? null,
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  // Discard the draft
  public async deleteDraft(payload: DeleteDraftInputType & { userId: string }) {
    const { formId } = await deleteDraftInput.parseAsync(payload);
    const { userId } = payload;

    await db
      .delete(formDraftsTable)
      .where(and(eq(formDraftsTable.formId, formId), eq(formDraftsTable.userId, userId)));

    return { success: true };
  }
}

export default FormDraftService;
