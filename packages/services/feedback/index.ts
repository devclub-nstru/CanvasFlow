import { aliasedTable, and, asc, count, db, desc, eq, gte, isNull, sql } from "@repo/database";
import { usersTable } from "@repo/database/models/auth";
import { feedbackTable } from "@repo/database/models/feedback";

import {
  getFeedbackInput,
  listFeedbackInput,
  submitFeedbackInput,
  updateFeedbackInput,
  type FeedbackStatsOutputType,
  type GetFeedbackInputType,
  type GetFeedbackOutputType,
  type ListFeedbackInputType,
  type ListFeedbackOutputType,
  type SubmitFeedbackInputType,
  type SubmitFeedbackOutputType,
  type UpdateFeedbackInputType,
  type UpdateFeedbackOutputType,
} from "./model";

const reporterUsers = aliasedTable(usersTable, "reporter_users");
const assigneeUsers = aliasedTable(usersTable, "assignee_users");

const feedbackSelection = {
  id: feedbackTable.id,
  type: feedbackTable.type,
  subject: feedbackTable.subject,
  message: feedbackTable.message,
  status: feedbackTable.status,

  reporterId: feedbackTable.userId,
  reporterName: reporterUsers.name,
  reporterEmail: sql<string | null>`coalesce(${feedbackTable.email}, ${reporterUsers.email})`,

  assignedTo: feedbackTable.assignedTo,
  assigneeName: assigneeUsers.name,
  assigneeEmail: assigneeUsers.email,

  pageUrl: feedbackTable.pageUrl,
  userAgent: feedbackTable.userAgent,

  createdAt: feedbackTable.createdAt,
  updatedAt: feedbackTable.updatedAt,
};

// Per-reporter hourly limit
const MAX_PER_IDENTITY_PER_HOUR = 10;

const priorityForType = (type: SubmitFeedbackInputType["type"]) =>
  type === "bug" || type === "complaint" ? ("high" as const) : ("medium" as const);

class FeedbackService {
  public async submitFeedback(
    payload: SubmitFeedbackInputType & {
      identity?: { userId?: string | null; email?: string | null };
      userAgent?: string | null;
    },
  ): Promise<SubmitFeedbackOutputType> {
    const input = await submitFeedbackInput.parseAsync(payload);

    const userId = payload.identity?.userId ?? null;
    const email = payload.identity?.email ?? null;

    if (userId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recent] = await db
        .select({ value: count() })
        .from(feedbackTable)
        .where(and(eq(feedbackTable.userId, userId), gte(feedbackTable.createdAt, oneHourAgo)));

      if ((recent?.value ?? 0) >= MAX_PER_IDENTITY_PER_HOUR) {
        throw new Error("You've sent a lot of reports recently. Please try again later.");
      }
    }

    const [row] = await db
      .insert(feedbackTable)
      .values({
        type: input.type,
        subject: input.subject,
        message: input.message,
        priority: priorityForType(input.type),
        userId,
        email,
        pageUrl: input.pageUrl ?? null,
        userAgent: payload.userAgent ? payload.userAgent.slice(0, 512) : null,
      })
      .returning({ id: feedbackTable.id });

    if (!row) throw new Error("Failed to save feedback");

    return { id: row.id };
  }

  /* ── Admin triage ───────────────────────────────────────────────────── */

  public async listFeedback(
    payload: ListFeedbackInputType & { viewerId: string },
  ): Promise<ListFeedbackOutputType> {
    const input = await listFeedbackInput.parseAsync(payload);
    const { viewerId } = payload;

    const filters = [
      input.status ? eq(feedbackTable.status, input.status) : undefined,
      input.type ? eq(feedbackTable.type, input.type) : undefined,
      input.assignedToMe ? eq(feedbackTable.assignedTo, viewerId) : undefined,
      input.unassigned ? isNull(feedbackTable.assignedTo) : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...(filters as never[])) : undefined;

    const items = await db
      .select(feedbackSelection)
      .from(feedbackTable)
      .leftJoin(reporterUsers, eq(feedbackTable.userId, reporterUsers.id))
      .leftJoin(assigneeUsers, eq(feedbackTable.assignedTo, assigneeUsers.id))
      .where(where)
      .orderBy(desc(feedbackTable.createdAt), asc(feedbackTable.id))
      .limit(input.limit)
      .offset(input.offset);

    const [totalRow] = await db.select({ value: count() }).from(feedbackTable).where(where);

    return { items, total: Number(totalRow?.value ?? 0) };
  }

  public async getFeedback(payload: GetFeedbackInputType): Promise<GetFeedbackOutputType> {
    const { id } = await getFeedbackInput.parseAsync(payload);

    const [row] = await db
      .select(feedbackSelection)
      .from(feedbackTable)
      .leftJoin(reporterUsers, eq(feedbackTable.userId, reporterUsers.id))
      .leftJoin(assigneeUsers, eq(feedbackTable.assignedTo, assigneeUsers.id))
      .where(eq(feedbackTable.id, id))
      .limit(1);

    if (!row) throw new Error("Feedback not found");

    return row;
  }

  public async updateFeedback(
    payload: Omit<UpdateFeedbackInputType, "claim"> & { assignedTo?: string | null },
  ): Promise<UpdateFeedbackOutputType> {
    const input = await updateFeedbackInput.parseAsync(payload);

    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (payload.assignedTo !== undefined) patch.assignedTo = payload.assignedTo;

    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const [updated] = await db
      .update(feedbackTable)
      .set(patch)
      .where(eq(feedbackTable.id, input.id))
      .returning({ id: feedbackTable.id });

    if (!updated) throw new Error("Feedback not found");
    return this.getFeedback({ id: input.id });
  }

  public async getFeedbackStats(payload: { viewerId: string }): Promise<FeedbackStatsOutputType> {
    const rows = await db
      .select({ status: feedbackTable.status, value: count() })
      .from(feedbackTable)
      .groupBy(feedbackTable.status);

    const [mine] = await db
      .select({ value: count() })
      .from(feedbackTable)
      .where(eq(feedbackTable.assignedTo, payload.viewerId));

    const byStatus = new Map(rows.map((r) => [r.status, Number(r.value)]));
    const at = (s: string) => byStatus.get(s as never) ?? 0;

    return {
      open: at("open"),
      triaged: at("triaged"),
      inProgress: at("in_progress"),
      resolved: at("resolved"),
      closed: at("closed"),
      assignedToMe: Number(mine?.value ?? 0),
      total: [...byStatus.values()].reduce((a, b) => a + b, 0),
    };
  }
}

export default FeedbackService;
