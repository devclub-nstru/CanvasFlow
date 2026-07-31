import { pgTable, uuid, text, jsonb, timestamp, unique, index } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { usersTable } from "./auth";

/**
 * A partially-filled form, saved so a signed-in respondent can come back.
 *
 * The case this exists for: a fifty-question form, ten answered, and the person
 * needs to stop. Without somewhere to put those ten answers the only options
 * are submit something incomplete or lose it, and both are worse than pausing.
 *
 * Separate from `form_submissions` rather than a `status` column on it, for
 * three reasons that all point the same way:
 *   · A submission is a fact — it happened, it counts, analytics read it. A
 *     draft is a scratchpad that will be overwritten repeatedly and then
 *     deleted. Mixing them means every analytics query has to remember to
 *     filter, and the one that forgets silently reports abandoned drafts as
 *     responses.
 *   · Submissions are deliberately anonymous (a `visitor_id`, not a user).
 *     A draft has to be tied to an account, because that account is how we
 *     recognise the person on their return.
 *   · The dedupe indexes on submissions would fight repeated draft upserts.
 *
 * Requires an account by design. An anonymous visitor has no identity that
 * survives a new browser session, so a "draft" for them would be indistinguish-
 * able from a lost one — localStorage on the client is the honest tool there.
 */
export const formDraftsTable = pgTable(
  "form_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),

    userId: text("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),

    // Answers so far, keyed by field id. Same jsonb shape the renderer holds in
    // state, so restoring is an assignment rather than a translation.
    values: jsonb("values").notNull(),

    // The pages already visited, so the respondent resumes where they stopped
    // rather than at question one. Stored as the page-index path the renderer
    // walks; a plain "page number" wouldn't survive branching, where two people
    // on their third page can be on different pages.
    pagePath: jsonb("page_path"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return {
      // One draft per person per form. This is also the conflict target the
      // upsert relies on, so repeated autosaves rewrite a single row instead
      // of accumulating one per keystroke burst.
      uniqueFormAndUser: unique().on(table.formId, table.userId),
      // "Do I have a draft for this form?" on every form open.
      userFormIdx: index("form_drafts_user_form_idx").on(table.userId, table.formId),
    };
  },
);
