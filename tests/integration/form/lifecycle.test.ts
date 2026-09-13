import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { formLogicRulesTable, formLogicConditionsTable } from "@repo/database/models/form-logic";
import { formCollaboratorsTable } from "@repo/database/models/form-collaborator";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor, expectRejection } from "../helpers/caller";
import { makeForm, makeUser, type TestUser } from "../helpers/factories";

/* Building a form end to end, and the constraints the database enforces that
 * no amount of mocking can stand in for: a globally unique slug, a unique
 * (formId, index) per question, and the cascades that fire on delete. */

let author: TestUser;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  author = await makeUser({ name: "Author" });
});

afterAll(async () => {
  await closeRedis();
  await teardownDatabase();
});

/* ─── Creating ─────────────────────────────────────────────────────────── */

describe("form.createForm", () => {
  it("writes a real row owned by the caller", async () => {
    const caller = await callerFor(author);

    const { id } = await caller.form.createForm({ title: "Feedback", slug: "feedback" });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, id));
    expect(row?.title).toBe("Feedback");
    expect(row?.slug).toBe("feedback");
    expect(row?.ownerId).toBe(author.id);
  });

  it("starts unpublished, unarchived and open", async () => {
    const caller = await callerFor(author);
    const { id } = await caller.form.createForm({ title: "Feedback", slug: "feedback" });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, id));
    expect(row?.isPublished).toBe(false);
    expect(row?.isArchived).toBe(false);
    expect(row?.isOpen).toBe(true);
    expect(row?.publishedAt).toBeNull();
  });

  it("ignores an ownerId supplied by the client", async () => {
    const someoneElse = await makeUser();
    const caller = await callerFor(author);

    const { id } = await caller.form.createForm({
      title: "Feedback",
      slug: "feedback",
      /* The schema has an ownerId, but the procedure takes it from the session. */
      ownerId: someoneElse.id,
    } as Parameters<typeof caller.form.createForm>[0]);

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, id));
    expect(row?.ownerId).toBe(author.id);
  });

  it("refuses a slug already taken by the same author", async () => {
    const caller = await callerFor(author);
    await caller.form.createForm({ title: "First", slug: "feedback" });

    const error = await expectRejection(
      caller.form.createForm({ title: "Second", slug: "feedback" }),
    );
    expect(error.message).toMatch(/already exists/i);
  });

  it("refuses a slug taken by a different author, because slugs are global", async () => {
    /* Worth pinning explicitly: the unique index is on slug alone, not on
     * (ownerId, slug), so two accounts cannot both have a form at /feedback.
     * That is a product decision the schema is making. */
    await (await callerFor(author)).form.createForm({ title: "Mine", slug: "feedback" });

    const other = await makeUser({ name: "Other" });
    const error = await expectRejection(
      (await callerFor(other)).form.createForm({ title: "Theirs", slug: "feedback" }),
    );
    expect(error.message).toMatch(/already exists/i);
  });

  it("leaves no half-written row when the slug collides", async () => {
    const caller = await callerFor(author);
    await caller.form.createForm({ title: "First", slug: "feedback" });
    await expectRejection(caller.form.createForm({ title: "Second", slug: "feedback" }));

    const rows = await db.select().from(formsTable);
    expect(rows).toHaveLength(1);
  });

  it("rejects a slug the schema considers unsafe before reaching the database", async () => {
    const caller = await callerFor(author);
    for (const slug of ["Not Lowercase", "has spaces", "../admin", "trailing-"]) {
      await expectRejection(caller.form.createForm({ title: "X", slug }));
    }
    expect(await db.select().from(formsTable)).toHaveLength(0);
  });
});

/* ─── Questions ────────────────────────────────────────────────────────── */

describe("questions", () => {
  async function formFor(user: TestUser) {
    const caller = await callerFor(user);
    const { id } = await caller.form.createForm({ title: "Survey", slug: `s-${Date.now()}` });
    return { caller, formId: id };
  }

  it("are appended with increasing indexes", async () => {
    const { caller, formId } = await formFor(author);

    await caller.form.createFormField({ formId, label: "First", type: "TEXT" });
    await caller.form.createFormField({ formId, label: "Second", type: "TEXT" });
    await caller.form.createFormField({ formId, label: "Third", type: "TEXT" });

    const rows = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);

    const indexes = rows.map((row) => Number(row.index));
    expect(rows.map((row) => row.label)).toEqual(["First", "Second", "Third"]);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("cannot share an index within one form", async () => {
    /* form_fields has unique(formId, index) — two questions dropped at the same
     * position must collide rather than silently reorder. */
    const { caller, formId } = await formFor(author);

    await caller.form.createFormField({ formId, label: "First", type: "TEXT", index: "1.00" });
    const error = await expectRejection(
      caller.form.createFormField({ formId, label: "Clash", type: "TEXT", index: "1.00" }),
    );
    expect(error).toBeInstanceOf(Error);

    const rows = await db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formId));
    expect(rows).toHaveLength(1);
  });

  it("may share an index across two different forms", async () => {
    const first = await formFor(author);
    const second = await formFor(author);

    await first.caller.form.createFormField({
      formId: first.formId,
      label: "A",
      type: "TEXT",
      index: "1.00",
    });
    await expect(
      second.caller.form.createFormField({
        formId: second.formId,
        label: "B",
        type: "TEXT",
        index: "1.00",
      }),
    ).resolves.toBeDefined();
  });

  it("cannot be attached to a segment belonging to another form", async () => {
    const mine = await formFor(author);
    const theirs = await formFor(author);

    const segment = await mine.caller.form.createFormSegment({
      formId: mine.formId,
      title: "Mine",
    });

    const error = await expectRejection(
      theirs.caller.form.createFormField({
        formId: theirs.formId,
        label: "Smuggled",
        type: "TEXT",
        segmentId: segment.id,
      }),
    );
    expect(error.message).toMatch(/different form/i);
  });

  it("cannot be attached to a segment that does not exist", async () => {
    const { caller, formId } = await formFor(author);
    const error = await expectRejection(
      caller.form.createFormField({
        formId,
        label: "Orphan",
        type: "TEXT",
        segmentId: "00000000-0000-4000-8000-000000000000",
      }),
    );
    expect(error.message).toMatch(/segment not found/i);
  });
});

/* ─── Segments ─────────────────────────────────────────────────────────── */

describe("segments", () => {
  it("adopt the existing unassigned questions when the first one is created", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    await caller.form.createFormField({ formId, label: "Loose", type: "TEXT" });

    const created = await caller.form.createFormSegment({ formId, title: "Second half" });

    expect(created.createdDefaultSegment, "a first segment is materialised").not.toBeNull();

    const rows = await db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formId));
    expect(rows[0]?.segmentId).toBe(created.createdDefaultSegment?.id);
  });

  it("release their questions to the previous segment when deleted", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    const first = await caller.form.createFormSegment({ formId, title: "One" });
    const second = await caller.form.createFormSegment({ formId, title: "Two" });

    await caller.form.createFormField({
      formId,
      label: "In the second segment",
      type: "TEXT",
      segmentId: second.id,
    });

    const result = await caller.form.deleteFormSegment({ id: second.id });

    expect(result.releasedFieldCount).toBe(1);

    const [field] = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    expect(field?.segmentId, "the question moved rather than vanishing").toBe(first.id);
  });

  it("report nothing released when they were empty", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    await caller.form.createFormSegment({ formId, title: "One" });
    const second = await caller.form.createFormSegment({ formId, title: "Two" });

    const result = await caller.form.deleteFormSegment({ id: second.id });
    expect(result.releasedFieldCount).toBe(0);
  });

  it("leave their questions unassigned when the last segment goes", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    const only = await caller.form.createFormSegment({
      formId,
      title: "Only",
      adoptUnassignedFields: false,
    });
    await caller.form.createFormField({ formId, label: "Q", type: "TEXT", segmentId: only.id });

    await caller.form.deleteFormSegment({ id: only.id });

    const [field] = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    expect(field, "the question survives its segment").toBeDefined();
    expect(field?.segmentId).toBeNull();
  });
});

/* ─── Cascades ─────────────────────────────────────────────────────────── */

describe("deleting a form", () => {
  async function fullyBuiltForm(owner: TestUser) {
    const caller = await callerFor(owner);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    const segment = await caller.form.createFormSegment({ formId, title: "Section" });
    const first = await caller.form.createFormField({
      formId,
      label: "Do you agree?",
      type: "RADIO",
      segmentId: segment.id,
    });
    const second = await caller.form.createFormField({
      formId,
      label: "Why?",
      type: "TEXTAREA",
      segmentId: segment.id,
    });

    await caller.form.createLogicRule({
      formId,
      fieldId: first.id,
      action: "JUMP_TO_FIELD",
      targetFieldId: second.id,
      conditions: [{ fieldId: first.id, operator: "EQUALS", value: "yes" }],
    });

    const collaborator = await makeUser();
    await caller.form.addCollaborator({ formId, email: collaborator.email, role: "editor" });

    return { caller, formId };
  }

  it("takes its questions, segments, rules and conditions with it", async () => {
    const { caller, formId } = await fullyBuiltForm(author);

    await caller.form.deleteForm({ id: formId });

    expect(await db.select().from(formFieldsTable)).toHaveLength(0);
    expect(await db.select().from(formSegmentsTable)).toHaveLength(0);
    expect(await db.select().from(formLogicRulesTable)).toHaveLength(0);
    expect(await db.select().from(formLogicConditionsTable)).toHaveLength(0);
  });

  it("takes its collaborator rows with it", async () => {
    const { caller, formId } = await fullyBuiltForm(author);

    await caller.form.deleteForm({ id: formId });
    expect(await db.select().from(formCollaboratorsTable)).toHaveLength(0);
  });

  it("does not touch another form", async () => {
    const { caller, formId } = await fullyBuiltForm(author);
    const survivor = await makeForm(author, { slug: "survivor" });

    await caller.form.deleteForm({ id: formId });

    const rows = await db.select().from(formsTable);
    expect(rows.map((row) => row.id)).toEqual([survivor.id]);
  });
});

/* ─── The whole build, read back publicly ──────────────────────────────── */

describe("a published form", () => {
  it("comes back to a respondent with its questions, segments and rules", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    const segment = await caller.form.createFormSegment({ formId, title: "Section" });
    const first = await caller.form.createFormField({
      formId,
      label: "Do you agree?",
      type: "RADIO",
      segmentId: segment.id,
      options: ["yes", "no"],
    });
    const second = await caller.form.createFormField({
      formId,
      label: "Why?",
      type: "TEXTAREA",
      segmentId: segment.id,
    });
    await caller.form.createLogicRule({
      formId,
      fieldId: first.id,
      action: "JUMP_TO_FIELD",
      targetFieldId: second.id,
      conditions: [{ fieldId: first.id, operator: "EQUALS", value: "yes" }],
    });

    await caller.form.publishForm({ id: formId });

    const publicView = await anonymousCaller().form.getFormById({ id: formId });

    expect(publicView.fields.map((field) => field.label)).toEqual(["Do you agree?", "Why?"]);
    /* Creating the first segment also materialises "Segment 1" to hold whatever
     * was unassigned, so a form built this way has two. */
    expect(publicView.segments.map((s) => s.title)).toEqual(["Segment 1", "Section"]);
    expect(publicView.logicRules).toHaveLength(1);
    expect(publicView.logicRules[0]?.conditions).toHaveLength(1);
  });

  it("never exposes the owner's internal role or permissions to the public", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });
    await caller.form.publishForm({ id: formId });

    const publicView = await anonymousCaller().form.getFormById({ id: formId });
    expect(publicView.role).toBeUndefined();
    expect(publicView.permissions).toBeUndefined();
  });

  it("returns questions in index order, not insertion order", async () => {
    const caller = await callerFor(author);
    const { id: formId } = await caller.form.createForm({ title: "Survey", slug: "survey" });

    await caller.form.createFormField({ formId, label: "Third", type: "TEXT", index: "3.00" });
    await caller.form.createFormField({ formId, label: "First", type: "TEXT", index: "1.00" });
    await caller.form.createFormField({ formId, label: "Second", type: "TEXT", index: "2.00" });
    await caller.form.publishForm({ id: formId });

    const publicView = await anonymousCaller().form.getFormById({ id: formId });
    expect(publicView.fields.map((field) => field.label)).toEqual(["First", "Second", "Third"]);
  });
});
