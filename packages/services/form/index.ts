import { db, eq, and, gte, count, sql, usersTable } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formCollaboratorsTable } from "@repo/database/models/form-collaborator";

import {
  createFormInput,
  type CreateFormInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
  getFormInput,
  type GetFormInputType,
  getDashboardStatsInput,
  type GetDashboardStatsInputType,
  deleteFormInput,
  type DeleteFormInputType,
  listCollaboratorsInput,
  type ListCollaboratorsInputType,
  addCollaboratorInput,
  type AddCollaboratorInputType,
  updateCollaboratorRoleInput,
  type UpdateCollaboratorRoleInputType,
  removeCollaboratorInput,
  type RemoveCollaboratorInputType,
  transferOwnershipInput,
  type TransferOwnershipInputType,
  updateFormSettingsInput,
  type UpdateFormSettingsInputType,
  type FormRole,
  type FormPermissions,
} from "./model";

export async function checkFormAccess(formId: string, userId: string): Promise<FormRole | null> {
  const access = await db
    .select({
      ownerId: formsTable.ownerId,
      collaboratorRole: formCollaboratorsTable.role,
    })
    .from(formsTable)
    .leftJoin(
      formCollaboratorsTable,
      and(
        eq(formCollaboratorsTable.formId, formsTable.id),
        eq(formCollaboratorsTable.userId, userId),
      ),
    )
    .where(eq(formsTable.id, formId))
    .limit(1);

  const form = access[0];
  if (!form) return null;

  if (form.ownerId === userId) return "owner";
  if (form.collaboratorRole) return form.collaboratorRole as FormRole;

  return null;
}

export async function requireOwner(formId: string, userId: string): Promise<void> {
  const role = await checkFormAccess(formId, userId);
  if (role !== "owner") {
    throw new Error("Unauthorized: Owner access required");
  }
}

export async function requireEditor(formId: string, userId: string): Promise<void> {
  const role = await checkFormAccess(formId, userId);
  if (role !== "owner" && role !== "editor") {
    throw new Error("Unauthorized: Editor access required");
  }
}

export async function requireViewer(formId: string, userId: string): Promise<void> {
  const role = await checkFormAccess(formId, userId);
  if (role !== "owner" && role !== "editor" && role !== "viewer") {
    throw new Error("Unauthorized: Viewer access required");
  }
}

export function getFormPermissions(role: FormRole | null): FormPermissions {
  const isOwner = role === "owner";
  const isEditor = role === "editor";
  const isViewer = role === "viewer";

  const hasBuilderView = isOwner || isEditor;
  const hasBuilderEdit = isOwner || isEditor;
  const hasAnalyticsView = isOwner || isEditor || isViewer;
  const hasResponsesView = isOwner || isEditor || isViewer;

  return {
    builder: {
      canView: hasBuilderView,
      canEdit: hasBuilderEdit,
    },
    analytics: {
      canView: hasAnalyticsView,
    },
    responses: {
      canView: hasResponsesView,
    },
    settings: {
      canDelete: isOwner,
      canPublish: isOwner || isEditor,
      canArchive: isOwner,
      canShare: isOwner,
    },
  };
}

class FormService {
  private async getFormBySlug(slug: string) {
    const result = await db.select().from(formsTable).where(eq(formsTable.slug, slug));
    if (!result || result.length === 0) return null;
    return result[0];
  }

  public async getForm(payload: GetFormInputType & { userId: string }) {
    const { id } = await getFormInput.parseAsync(payload);
    const { userId } = payload;

    const role = await checkFormAccess(id, userId);
    if (!role) {
      throw new Error("Form not found or unauthorized");
    }

    const result = await db
      .select({
        form: formsTable,
        ownerEmail: usersTable.email,
      })
      .from(formsTable)
      .innerJoin(usersTable, eq(formsTable.ownerId, usersTable.id))
      .where(eq(formsTable.id, id));

    const row = result[0];
    if (!row) {
      throw new Error("Form not found");
    }

    return {
      ...row.form,
      ownerEmail: row.ownerEmail,
      role,
      permissions: getFormPermissions(role),
    };
  }

  public async createForm(payload: CreateFormInputType) {
    const { title, description, slug, ownerId } = await createFormInput.parseAsync(payload);

    const userResult = await db
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, ownerId));
    const userPlan = userResult[0]?.plan || "Free";

    let formLimit = 10;
    if (userPlan === "Pro") formLimit = 50;
    else if (userPlan === "Pro+") formLimit = 200;
    else if (userPlan === "Business") formLimit = Infinity;

    if (formLimit !== Infinity) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const existingForms = await db
        .select({ value: count() })
        .from(formsTable)
        .where(and(eq(formsTable.ownerId, ownerId), gte(formsTable.createdAt, startOfMonth)));

      if (Number(existingForms[0]?.value ?? 0) >= formLimit) {
        throw new Error(
          `You have reached the limit of ${formLimit} forms per month for the ${userPlan} tier.`,
        );
      }
    }

    const existingForm = await this.getFormBySlug(slug);
    if (existingForm) {
      throw new Error(`Form with slug ${slug} already exists`);
    }

    const insertResult = await db
      .insert(formsTable)
      .values({
        title,
        description,
        slug,
        ownerId,
      })
      .returning({
        id: formsTable.id,
      });

    if (!insertResult || insertResult.length === 0 || !insertResult[0]?.id) {
      throw new Error(`Failed to create form`);
    }

    return {
      id: insertResult[0].id,
    };
  }

  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    const forms = await db
      .select({
        id: formsTable.id,
        title: formsTable.title,
        description: formsTable.description,
        slug: formsTable.slug,
        isPublished: formsTable.isPublished,
        isArchived: formsTable.isArchived,
        isOpen: formsTable.isOpen,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
        publishedAt: formsTable.publishedAt,
        submissionsCount: count(formSubmissionsTable.id),
        collaboratorRole: formCollaboratorsTable.role,
        ownerId: formsTable.ownerId,
        ownerEmail: usersTable.email,
      })
      .from(formsTable)
      .leftJoin(formSubmissionsTable, eq(formsTable.id, formSubmissionsTable.formId))
      .leftJoin(
        formCollaboratorsTable,
        and(
          eq(formsTable.id, formCollaboratorsTable.formId),
          eq(formCollaboratorsTable.userId, userId),
        ),
      )
      .leftJoin(usersTable, eq(formsTable.ownerId, usersTable.id))
      .where(sql`${formsTable.ownerId} = ${userId} OR ${formCollaboratorsTable.userId} = ${userId}`)
      .groupBy(formsTable.id, formCollaboratorsTable.role, usersTable.email);

    return forms.map((f) => {
      const role: FormRole = f.ownerId === userId ? "owner" : (f.collaboratorRole as FormRole);
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        slug: f.slug,
        isPublished: f.isPublished,
        isArchived: f.isArchived,
        isOpen: f.isOpen,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        publishedAt: f.publishedAt,
        submissionsCount: f.submissionsCount,
        ownerEmail: f.ownerEmail,
        role,
        permissions: getFormPermissions(role),
      };
    });
  }

  public async getFormById(payload: GetFormInputType) {
    const { id } = await getFormInput.parseAsync(payload);

    const rows = await db
      .select({
        form: formsTable,
        field: formFieldsTable,
      })
      .from(formsTable)
      .leftJoin(formFieldsTable, eq(formsTable.id, formFieldsTable.formId))
      .where(eq(formsTable.id, id))
      .orderBy(formFieldsTable.index);

    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error("Form not found");
    }

    const submissionsCountRows = await db
      .select({ value: count() })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, id));
    const submissionsCount = Number(submissionsCountRows[0]?.value ?? 0);

    const form = firstRow.form;
    const fields = rows
      .map((r) => r.field)
      .filter((f): f is NonNullable<typeof f> => !!(f && f.id));

    return {
      ...form,
      fields,
      submissionsCount,
      role: undefined,
      permissions: undefined,
    };
  }

  public async publishForm(payload: GetFormInputType & { ownerId: string }) {
    const { id } = await getFormInput.parseAsync(payload);
    const { ownerId: userId } = payload;

    await requireEditor(id, userId);

    const result = await db
      .update(formsTable)
      .set({
        isPublished: true,
        publishedAt: new Date(),
      })
      .where(eq(formsTable.id, id))
      .returning({
        id: formsTable.id,
      });

    const firstResult = result[0];
    if (!firstResult) {
      throw new Error("Form not found");
    }

    return {
      id: firstResult.id,
    };
  }

  public async deleteForm(payload: DeleteFormInputType & { ownerId: string }) {
    const { id } = await deleteFormInput.parseAsync(payload);
    const { ownerId: userId } = payload;

    await requireOwner(id, userId);

    const result = await db
      .delete(formsTable)
      .where(eq(formsTable.id, id))
      .returning({ id: formsTable.id });

    if (!result[0]) throw new Error("Form not found");

    return { success: true };
  }

  public async getDashboardStats(payload: GetDashboardStatsInputType) {
    const { userId } = await getDashboardStatsInput.parseAsync(payload);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Trend chart covers up to 90 days so the dashboard can render
    // 7d / 30d / 90d windows from a single fetch.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    // ─── One round-trip, one connection ──────────────────────────────────
    //
    // The dashboard used to fan out four queries through Promise.all. On
    // a cold pool each one had to wait its turn for a fresh TLS handshake
    // to Neon's pooler (~300ms each), which serialized into ~1.7s wall
    // time despite "running in parallel".
    //
    // Collapsing into a single statement with subqueries:
    //   • one pg connection acquired (no handshake contention)
    //   • one Neon round-trip
    //   • Postgres planner can share the `forms WHERE owner_id` scan
    //     across the four sub-aggregates instead of repeating it.
    //
    // Output shape mirrors the four old result sets so the JS below
    // didn't need to change.
    type DashboardRow = {
      forms: Array<{ id: string; title: string; is_published: boolean; created_at: string }> | null;
      agg: { total: number; month: number } | null;
      per_form: Array<{ form_id: string; cnt: number }> | null;
      trends: Array<{ created_at: string }> | null;
    };
    const rows = await db.execute<DashboardRow>(sql`
      with owned as (
        select id, title, is_published, created_at
        from ${formsTable}
        where ${formsTable.ownerId} = ${userId}
      )
      select
        (select coalesce(json_agg(owned), '[]'::json) from owned) as forms,
        (
          select json_build_object(
            'total', count(*),
            'month', count(*) filter (where s.created_at >= ${startOfMonth})
          )
          from ${formSubmissionsTable} s
          join owned o on s.form_id = o.id
        ) as agg,
        (
          select coalesce(json_agg(t), '[]'::json) from (
            select s.form_id, count(*)::int as cnt
            from ${formSubmissionsTable} s
            join owned o on s.form_id = o.id
            group by s.form_id
          ) t
        ) as per_form,
        (
          select coalesce(json_agg(t), '[]'::json) from (
            select s.created_at
            from ${formSubmissionsTable} s
            join owned o on s.form_id = o.id
            where s.created_at >= ${ninetyDaysAgo}
          ) t
        ) as trends
    `);

    const row = (rows as any).rows?.[0] as DashboardRow | undefined;
    const forms = (row?.forms ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      isPublished: f.is_published,
      createdAt: new Date(f.created_at),
    }));
    const aggRow = [
      {
        total: row?.agg?.total ?? 0,
        month: row?.agg?.month ?? 0,
      },
    ];
    const perFormCounts = (row?.per_form ?? []).map((r) => ({
      formId: r.form_id,
      value: r.cnt,
    }));
    const trendRows = (row?.trends ?? []).map((r) => ({
      createdAt: new Date(r.created_at),
    }));

    const totalSketches = forms.length;
    const publishedSketches = forms.filter((f) => f.isPublished).length;

    if (totalSketches === 0) {
      return {
        totalSketches: 0,
        publishedSketches: 0,
        totalResponses: 0,
        responsesThisMonth: 0,
        recentForms: [],
        trends: [],
      };
    }

    // Sort in memory and grab the four most recent — avoids the second
    // SELECT on formsTable that the old implementation made.
    const recentFormsRaw = [...forms]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 4);

    const totalResponses = Number(aggRow[0]?.total ?? 0);
    const responsesThisMonth = Number(aggRow[0]?.month ?? 0);

    const countByForm = new Map(perFormCounts.map((r) => [r.formId, Number(r.value)]));
    const recentForms = recentFormsRaw.map((f) => ({
      id: f.id,
      title: f.title,
      createdAt: f.createdAt,
      isPublished: f.isPublished,
      submissionsCount: countByForm.get(f.id) ?? 0,
    }));

    const trendsMap: Record<string, number> = {};
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      trendsMap[dateStr] = 0;
    }

    trendRows.forEach((s) => {
      const dateStr = new Date(s.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (trendsMap[dateStr] !== undefined) {
        trendsMap[dateStr]++;
      }
    });

    const trends = Object.entries(trendsMap).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalSketches,
      publishedSketches,
      totalResponses,
      responsesThisMonth,
      recentForms,
      trends,
    };
  }

  // Collaborator management
  public async listCollaborators(payload: ListCollaboratorsInputType & { userId: string }) {
    const { formId } = await listCollaboratorsInput.parseAsync(payload);
    const { userId } = payload;

    await requireOwner(formId, userId);

    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: formCollaboratorsTable.role,
        addedBy: formCollaboratorsTable.addedBy,
      })
      .from(formCollaboratorsTable)
      .innerJoin(usersTable, eq(formCollaboratorsTable.userId, usersTable.id))
      .where(eq(formCollaboratorsTable.formId, formId));

    return result.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      role: c.role as "viewer" | "editor",
      addedBy: c.addedBy,
    }));
  }

  public async addCollaborator(payload: AddCollaboratorInputType & { requesterId: string }) {
    const { formId, email, role } = await addCollaboratorInput.parseAsync(payload);
    const { requesterId } = payload;

    await requireOwner(formId, requesterId);

    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const targetUser = users[0];
    if (!targetUser) {
      throw new Error("User with this email not found");
    }

    const form = await db
      .select({ ownerId: formsTable.ownerId })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    if (!form[0]) {
      throw new Error("Form not found");
    }
    if (form[0].ownerId === targetUser.id) {
      throw new Error("Cannot add the form owner as a collaborator");
    }

    const existing = await db
      .select()
      .from(formCollaboratorsTable)
      .where(
        and(
          eq(formCollaboratorsTable.formId, formId),
          eq(formCollaboratorsTable.userId, targetUser.id),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new Error("User is already a collaborator on this form");
    }

    await db.insert(formCollaboratorsTable).values({
      formId,
      userId: targetUser.id,
      role,
      addedBy: requesterId,
    });

    return { success: true };
  }

  public async updateCollaboratorRole(
    payload: UpdateCollaboratorRoleInputType & { requesterId: string },
  ) {
    const {
      formId,
      userId: targetUserId,
      role,
    } = await updateCollaboratorRoleInput.parseAsync(payload);
    const { requesterId } = payload;

    await requireOwner(formId, requesterId);

    const form = await db
      .select({ ownerId: formsTable.ownerId })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    if (!form[0]) {
      throw new Error("Form not found");
    }
    if (form[0].ownerId === targetUserId) {
      throw new Error("Cannot modify owner role");
    }
    if (requesterId === targetUserId) {
      throw new Error("Cannot modify your own collaborator role");
    }

    const result = await db
      .update(formCollaboratorsTable)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(formCollaboratorsTable.formId, formId),
          eq(formCollaboratorsTable.userId, targetUserId),
        ),
      )
      .returning({ id: formCollaboratorsTable.id });

    if (!result[0]) {
      throw new Error("Collaborator not found");
    }

    return { success: true };
  }

  public async removeCollaborator(payload: RemoveCollaboratorInputType & { requesterId: string }) {
    const { formId, userId: targetUserId } = await removeCollaboratorInput.parseAsync(payload);
    const { requesterId } = payload;

    await requireOwner(formId, requesterId);

    const form = await db
      .select({ ownerId: formsTable.ownerId })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    if (!form[0]) {
      throw new Error("Form not found");
    }
    if (form[0].ownerId === targetUserId) {
      throw new Error("Cannot remove owner");
    }
    if (requesterId === targetUserId) {
      throw new Error("Cannot remove yourself");
    }

    const result = await db
      .delete(formCollaboratorsTable)
      .where(
        and(
          eq(formCollaboratorsTable.formId, formId),
          eq(formCollaboratorsTable.userId, targetUserId),
        ),
      )
      .returning({ id: formCollaboratorsTable.id });

    if (!result[0]) {
      throw new Error("Collaborator not found");
    }

    return { success: true };
  }

  public async transferOwnership(payload: TransferOwnershipInputType & { requesterId: string }) {
    const { formId, targetUserId } = await transferOwnershipInput.parseAsync(payload);
    const { requesterId } = payload;

    await requireOwner(formId, requesterId);

    if (requesterId === targetUserId) {
      throw new Error("You are already the owner of this form");
    }

    const targetUser = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1);

    if (!targetUser[0]) {
      throw new Error("Target user not found");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(formsTable)
        .set({ ownerId: targetUserId, updatedAt: new Date() })
        .where(eq(formsTable.id, formId));

      await tx
        .delete(formCollaboratorsTable)
        .where(
          and(
            eq(formCollaboratorsTable.formId, formId),
            eq(formCollaboratorsTable.userId, targetUserId),
          ),
        );

      await tx
        .insert(formCollaboratorsTable)
        .values({
          formId,
          userId: requesterId,
          role: "editor",
          addedBy: targetUserId,
        })
        .onConflictDoUpdate({
          target: [formCollaboratorsTable.formId, formCollaboratorsTable.userId],
          set: { role: "editor", updatedAt: new Date() },
        });
    });

    return { success: true };
  }

  public async updateFormSettings(payload: UpdateFormSettingsInputType & { requesterId: string }) {
    const { id, title, description, isOpen, maxSubmissions, expiresAt } =
      await updateFormSettingsInput.parseAsync(payload);
    const { requesterId } = payload;

    await requireOwner(id, requesterId);

    await db
      .update(formsTable)
      .set({
        title,
        description: description ?? null,
        isOpen,
        maxSubmissions: maxSubmissions ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(formsTable.id, id));

    return { success: true };
  }
}

export default FormService;
