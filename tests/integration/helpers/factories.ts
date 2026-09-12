import crypto from "node:crypto";
import { db, usersTable, sessionsTable } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formCollaboratorsTable } from "@repo/database/models/form-collaborator";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { formFieldsTable } from "@repo/database/models/form-field";

/* Fixtures are inserted directly rather than built through the API.
 *
 * Setup through the public API is more realistic but makes every failure a
 * cascade — a broken createForm fails fifty unrelated tests. Direct inserts
 * keep a failure pointing at the thing actually under test. The procedures get
 * exercised as the subject, not as scaffolding. */

let seq = 0;
const unique = () => `${Date.now().toString(36)}-${++seq}`;

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export async function makeUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const id = overrides.id ?? `user_${unique()}`;
  const user: TestUser = {
    id,
    email: overrides.email ?? `${id}@example.test`,
    name: overrides.name ?? "Test Person",
  };

  await db.insert(usersTable).values({ ...user, emailVerified: true });
  return user;
}

/** A live session row plus the JWT that points at it. */
export async function makeSession(user: TestUser): Promise<{ token: string; sessionId: string }> {
  const jwt = (await import("jsonwebtoken")).default;
  const { authSecret } = await import("@repo/trpc/server/auth");

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, sid: sessionId },
    authSecret(),
    { expiresIn: "7d" },
  );

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: user.id,
    token: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt,
  });

  return { token, sessionId };
}

export interface TestForm {
  id: string;
  slug: string;
  ownerId: string;
}

export async function makeForm(
  owner: TestUser,
  overrides: Partial<typeof formsTable.$inferInsert> = {},
): Promise<TestForm> {
  const slug = (overrides.slug as string | undefined) ?? `form-${unique()}`;

  const [row] = await db
    .insert(formsTable)
    .values({
      title: "Test form",
      slug,
      ownerId: owner.id,
      ...overrides,
    })
    .returning({ id: formsTable.id, slug: formsTable.slug, ownerId: formsTable.ownerId });

  return row as TestForm;
}

export async function makeCollaborator(
  form: TestForm,
  user: TestUser,
  role: "viewer" | "editor",
  addedBy?: TestUser,
): Promise<void> {
  await db.insert(formCollaboratorsTable).values({
    formId: form.id,
    userId: user.id,
    role,
    addedBy: addedBy?.id ?? form.ownerId,
  });
}

export async function makeSegment(
  form: TestForm,
  overrides: Partial<typeof formSegmentsTable.$inferInsert> = {},
): Promise<{ id: string }> {
  const [row] = await db
    .insert(formSegmentsTable)
    .values({
      formId: form.id,
      title: "Segment",
      index: "1",
      ...overrides,
    })
    .returning({ id: formSegmentsTable.id });

  return row as { id: string };
}

export async function makeField(
  form: TestForm,
  overrides: Partial<typeof formFieldsTable.$inferInsert> = {},
): Promise<{ id: string }> {
  const [row] = await db
    .insert(formFieldsTable)
    .values({
      formId: form.id,
      label: "A question",
      /* NOT NULL with no default — the service derives it from the label. */
      labelKey: `q_${++seq}`,
      type: "TEXT",
      index: String(seq),
      ...overrides,
    })
    .returning({ id: formFieldsTable.id });

  return row as { id: string };
}

/** Owner, an editor, a viewer and an unrelated stranger, all on one form. */
export async function makeCast(formOverrides: Partial<typeof formsTable.$inferInsert> = {}) {
  const owner = await makeUser({ name: "Owner" });
  const editor = await makeUser({ name: "Editor" });
  const viewer = await makeUser({ name: "Viewer" });
  const stranger = await makeUser({ name: "Stranger" });

  const form = await makeForm(owner, formOverrides);
  await makeCollaborator(form, editor, "editor", owner);
  await makeCollaborator(form, viewer, "viewer", owner);

  return { owner, editor, viewer, stranger, form };
}
