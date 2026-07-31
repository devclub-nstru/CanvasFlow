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

/**
 * How many questions a respondent sees at once.
 *
 * AUTO is the default and the reason this isn't just a boolean: the right
 * answer depends on the form's shape. A form that was never split into
 * segments is a single train of questions and reads best one at a time; a form
 * with segments has already been divided into pages by its author, and showing
 * those pages is what they were for. AUTO follows that, so an author who adds a
 * second segment gets page-per-segment without having to discover a setting.
 *
 * The three explicit values exist for when the author disagrees:
 *   ONE_PER_PAGE     — one question at a time regardless of segments.
 *   SEGMENT_PER_PAGE — a page per segment. With no segments this is the whole
 *                      form on one page, which is the honest reading.
 *   ALL_AT_ONCE      — everything on one page, Google Forms style.
 */
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

    /* ── Who may respond ─────────────────────────────────────────────────
     *
     * These four settle into a dependency the service enforces rather than
     * the schema: `collect_respondent_email`, `one_response_per_respondent`
     * and `allowed_email_domains` are all meaningless without a signed-in
     * respondent, so each one implies `require_sign_in`. A CHECK constraint
     * could express that, but it would reject an editor who ticks "collect
     * email" before ticking "require sign-in" — so the service raises the
     * flag instead of refusing the write. */

    // Respondents must be signed in. Everything below depends on it, because
    // an account is the only respondent identity that survives a cleared
    // browser or a second device.
    requireSignIn: boolean("require_sign_in").default(false).notNull(),

    // Record the signed-in respondent's account email against the response.
    // Taken from the session, never from anything the client sends.
    collectRespondentEmail: boolean("collect_respondent_email").default(false).notNull(),

    // One response per account. Multiple responses are the default: the old
    // behaviour was a hard one-per-browser lockout, which punished shared
    // computers and was defeated by a different device.
    oneResponsePerRespondent: boolean("one_response_per_respondent").default(false).notNull(),

    // Email domains permitted to respond, e.g. ["rishihood.edu.in"]. Matched
    // as a suffix, so an entry covers its subdomains too — one entry lets in
    // both alice@rishihood.edu.in and bob@nst.rishihood.edu.in, which is what
    // "the same institution" means in practice. NULL or empty = open.
    allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>(),

    // Shown on the thank-you screen underneath the app's own confirmation,
    // not instead of it: the respondent still needs to know the submission
    // landed, and the author's note is additional context on top of that.
    thankYouMessage: text("thank_you_message"),

    // Optimistic-lock counter — incremented on every mutating update.
    // Concurrent writers compare-and-set against this; the loser gets a
    // 409-style conflict instead of silently overwriting fresher data.
    version: integer("version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    publishedAt: timestamp("published_at"),
  },
  (table) => ({
    // Hot path: list/stats/limit queries filter by owner, often ordered by createdAt.
    ownerCreatedIdx: index("forms_owner_created_idx").on(table.ownerId, table.createdAt),
  }),
);
