import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const adminAuditActionEnum = pgEnum("admin_audit_action", [
  "user.suspended",
  "user.unsuspended",
  "user.signed_out",
  "user.password_reset",
  "admin.granted",
  "admin.revoked",
  "signup.code_resent",
  "signup.deleted",
  "feedback.claimed",
  "feedback.released",
  "feedback.status_changed",
]);

export type AdminAuditAction = (typeof adminAuditActionEnum.enumValues)[number];

export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    actorId: text("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorEmail: varchar("actor_email", { length: 255 }).notNull(),

    action: adminAuditActionEnum("action").notNull(),

    targetUserId: text("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    targetLabel: varchar("target_label", { length: 255 }),

    detail: jsonb("detail").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    createdIdx: index("admin_audit_created_idx").on(table.createdAt),
    targetIdx: index("admin_audit_target_idx").on(table.targetUserId, table.createdAt),
    actorIdx: index("admin_audit_actor_idx").on(table.actorId, table.createdAt),
  }),
);

export type SelectAdminAudit = typeof adminAuditLogTable.$inferSelect;
export type InsertAdminAudit = typeof adminAuditLogTable.$inferInsert;
