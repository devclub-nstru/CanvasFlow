import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
  integer,
  index,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const questionLayoutEnum = pgEnum("question_layout", [
  "AUTO",
  "ONE_PER_PAGE",
  "SEGMENT_PER_PAGE",
  "ALL_AT_ONCE",
]);

export const formsTable = pgTable(
  "forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    title: varchar("title", { length: 150 }).notNull(),
    description: text("description"),

    slug: varchar("slug", { length: 150 }).notNull().unique(),

    ownerId: text("owner_id")
      .references(() => usersTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    isPublished: boolean("is_published").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isOpen: boolean("is_open").default(true).notNull(),
    expiresAt: timestamp("expires_at"),

    questionLayout: questionLayoutEnum("question_layout").notNull().default("AUTO"),

    requireSignIn: boolean("require_sign_in").default(false).notNull(),

    collectRespondentEmail: boolean("collect_respondent_email").default(false).notNull(),

    oneResponsePerRespondent: boolean("one_response_per_respondent").default(false).notNull(),

    allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>(),

    thankYouMessage: text("thank_you_message"),

    version: integer("version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    publishedAt: timestamp("published_at"),
  },
  (table) => ({
    ownerCreatedIdx: index("forms_owner_created_idx").on(table.ownerId, table.createdAt),
  }),
);
