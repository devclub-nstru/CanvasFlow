import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "bug",
  "feedback",
  "complaint",
  "feature_request",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "open",
  "triaged",
  "resolved",
  "closed",
]);

export const feedbackPriorityEnum = pgEnum("feedback_priority", ["low", "medium", "high"]);

export const feedbackTable = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    type: feedbackTypeEnum("type").notNull().default("feedback"),
    subject: varchar("subject", { length: 120 }).notNull(),
    message: text("message").notNull(),

    status: feedbackStatusEnum("status").notNull().default("open"),
    priority: feedbackPriorityEnum("priority").notNull().default("medium"),

    userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }),
    pageUrl: varchar("page_url", { length: 2048 }),
    userAgent: varchar("user_agent", { length: 512 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    statusCreatedIdx: index("feedback_status_created_idx").on(table.status, table.createdAt),
    userCreatedIdx: index("feedback_user_created_idx").on(table.userId, table.createdAt),
    emailCreatedIdx: index("feedback_email_created_idx").on(table.email, table.createdAt),
  }),
);

export type SelectFeedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = typeof feedbackTable.$inferInsert;
