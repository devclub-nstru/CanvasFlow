import {
  pgEnum,
  pgTable,
  varchar,
  timestamp,
  boolean,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "superadmin"]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),

  name: text("name").default("").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(table.userId),
    expiresIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const accountsTable = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("account_user_id_idx").on(table.userId),
    providerAccountUniqIdx: uniqueIndex("account_provider_account_uniq_idx").on(
      table.providerId,
      table.accountId,
    ),
  }),
);

export const verificationsTable = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => ({
    valueUniqIdx: uniqueIndex("verification_value_uniq_idx").on(table.value),
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
    expiresIdx: index("verification_expires_at_idx").on(table.expiresAt),
  }),
);

export const pendingSignupsTable = pgTable(
  "pending_signups",
  {
    id: text("id").primaryKey(),

    email: varchar("email", { length: 255 }).notNull(),
    name: text("name").default("").notNull(),
    passwordHash: text("password_hash").notNull(),

    codeHash: text("code_hash").notNull(),

    attempts: integer("attempts").default(0).notNull(),

    expiresAt: timestamp("expires_at").notNull(),
    lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailUniqIdx: uniqueIndex("pending_signups_email_uniq_idx").on(table.email),
    expiresIdx: index("pending_signups_expires_at_idx").on(table.expiresAt),
  }),
);

export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type SelectPendingSignup = typeof pendingSignupsTable.$inferSelect;
