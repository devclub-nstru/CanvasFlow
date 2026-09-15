import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sessionsTable } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formCollaboratorsTable } from "@repo/database/models/form-collaborator";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor, expectRejection } from "../helpers/caller";
import { makeCast, makeCollaborator, makeField, makeForm, makeUser } from "../helpers/factories";


beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

afterAll(async () => {
  await closeRedis();
  await teardownDatabase();
});

/* ─── Reading a form ───────────────────────────────────────────────────── */

describe("form.getForm", () => {
  it("gives the owner their form, with an owner's permissions", async () => {
    const { owner, form } = await makeCast();
    const caller = await callerFor(owner);

    const result = await caller.form.getForm({ id: form.id });

    expect(result.id).toBe(form.id);
    expect(result.role).toBe("owner");
    expect(result.permissions?.settings.canDelete).toBe(true);
  });

  it("resolves an editor through the collaborator join", async () => {
    const { editor, form } = await makeCast();
    const caller = await callerFor(editor);

    const result = await caller.form.getForm({ id: form.id });

    expect(result.role).toBe("editor");
    expect(result.permissions?.builder.canEdit).toBe(true);
    expect(result.permissions?.settings.canDelete).toBe(false);
  });

  it("resolves a viewer through the same join", async () => {
    const { viewer, form } = await makeCast();
    const caller = await callerFor(viewer);

    const result = await caller.form.getForm({ id: form.id });

    expect(result.role).toBe("viewer");
    expect(result.permissions?.builder.canView).toBe(false);
    expect(result.permissions?.responses.canView).toBe(true);
  });

  it("refuses a stranger", async () => {
    const { stranger, form } = await makeCast();
    const caller = await callerFor(stranger);

    const error = await expectRejection(caller.form.getForm({ id: form.id }));
    expect(error.message).toMatch(/not found or unauthorized/i);
  });

  it("tells a stranger the same thing for a form that does not exist", async () => {
    const { stranger } = await makeCast();
    const caller = await callerFor(stranger);

    const missing = await expectRejection(
      caller.form.getForm({ id: "00000000-0000-4000-8000-000000000000" }),
    );
    const forbidden = await expectRejection(
      caller.form.getForm({ id: (await makeForm(await makeUser())).id }),
    );

    expect(forbidden.message, "existence must not be inferable from the error").toBe(
      missing.message,
    );
  });

  it("refuses an unauthenticated caller before touching the database", async () => {
    const { form } = await makeCast();
    const error = await expectRejection(anonymousCaller().form.getForm({ id: form.id }));
    expect(error.message).toMatch(/not logged in/i);
  });

  it("stops honouring a token once its session row is gone", async () => {
    const { owner, form } = await makeCast();
    const caller = await callerFor(owner);

    await expect(caller.form.getForm({ id: form.id })).resolves.toBeDefined();

    /* Sign-out deletes the row; the JWT itself is still perfectly valid. */
    await db.delete(sessionsTable);

    const error = await expectRejection(caller.form.getForm({ id: form.id }));
    expect(error.message).toMatch(/not logged in/i);
  });
});

/* ─── Editing ──────────────────────────────────────────────────────────── */

describe("editor-only operations", () => {
  it("let an owner publish", async () => {
    const { owner, form } = await makeCast();
    const caller = await callerFor(owner);

    await caller.form.publishForm({ id: form.id });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.isPublished).toBe(true);
    expect(row?.publishedAt).not.toBeNull();
  });

  it("let an editor publish", async () => {
    const { editor, form } = await makeCast();
    const caller = await callerFor(editor);

    await expect(caller.form.publishForm({ id: form.id })).resolves.toBeDefined();
  });

  it("refuse a viewer", async () => {
    const { viewer, form } = await makeCast();
    const caller = await callerFor(viewer);

    const error = await expectRejection(caller.form.publishForm({ id: form.id }));
    expect(error.message).toMatch(/editor access required/i);
  });

  it("leave the form untouched when they refuse", async () => {
    const { viewer, form } = await makeCast();
    const caller = await callerFor(viewer);

    await expectRejection(caller.form.publishForm({ id: form.id }));

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.isPublished, "a refused call must not half-apply").toBe(false);
  });

  it("let an editor add a question", async () => {
    const { editor, form } = await makeCast();
    const caller = await callerFor(editor);

    const created = await caller.form.createFormField({
      formId: form.id,
      label: "Your name",
      type: "TEXT",
    });

    expect(created.id).toBeTruthy();
  });

  it("refuse a viewer adding a question", async () => {
    const { viewer, form } = await makeCast();
    const caller = await callerFor(viewer);

    const error = await expectRejection(
      caller.form.createFormField({ formId: form.id, label: "Sneaky", type: "TEXT" }),
    );
    expect(error.message).toMatch(/editor access required/i);
  });

  it("let an editor change the form's settings", async () => {
    const { editor, form } = await makeCast();
    const caller = await callerFor(editor);

    await caller.form.updateFormSettings({
      id: form.id,
      title: "Renamed by an editor",
      isOpen: true,
    });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.title).toBe("Renamed by an editor");
  });

  it("refuse a viewer changing the settings", async () => {
    const { viewer, form } = await makeCast();
    const caller = await callerFor(viewer);

    const error = await expectRejection(
      caller.form.updateFormSettings({ id: form.id, title: "Nope", isOpen: true }),
    );
    expect(error.message).toMatch(/editor access required/i);
  });
});

/* ─── Deleting a response ──────────────────────────────────────────────── */

describe("form.deleteSubmission", () => {
  /* A published form with one answer sitting in it, ready to be deleted. */
  async function castWithOneResponse() {
    const cast = await makeCast({ isPublished: true });
    const field = await makeField(cast.form, { label: "How was it?" });

    const { id: submissionId } = await anonymousCaller().form.submitForm({
      formId: cast.form.id,
      values: [{ formFieldId: field.id, value: "Good" }],
    });

    return { ...cast, submissionId };
  }

  it("lets the owner delete a response", async () => {
    const { owner, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(owner);

    await caller.form.deleteSubmission({ formId: form.id, submissionId });

    const { submissions } = await caller.form.getSubmissions({ formId: form.id });
    expect(submissions).toHaveLength(0);
  });

  it("lets an editor delete a response", async () => {
    const { editor, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(editor);

    await expect(caller.form.deleteSubmission({ formId: form.id, submissionId })).resolves.toEqual({
      success: true,
    });
  });

  it("refuses a viewer", async () => {
    const { viewer, owner, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(viewer);

    const error = await expectRejection(
      caller.form.deleteSubmission({ formId: form.id, submissionId }),
    );
    expect(error.message).toMatch(/editor access required/i);

    const ownerCaller = await callerFor(owner);
    const { submissions } = await ownerCaller.form.getSubmissions({ formId: form.id });
    expect(submissions, "a refused delete must leave the response in place").toHaveLength(1);
  });

  it("refuses a stranger", async () => {
    const { stranger, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(stranger);

    await expectRejection(caller.form.deleteSubmission({ formId: form.id, submissionId }));
  });

  it("will not delete a response that belongs to someone else's form", async () => {
    const { submissionId } = await castWithOneResponse();
    const outsider = await makeUser({ name: "Outsider" });
    const theirForm = await makeForm(outsider);
    const caller = await callerFor(outsider);

    /* Owner of `theirForm`, but the submission id is from another form — the
     * formId in the call must not be enough to reach it. */
    const error = await expectRejection(
      caller.form.deleteSubmission({ formId: theirForm.id, submissionId }),
    );
    expect(error.message).toMatch(/not found/i);
  });

  it("refuses once the form is archived", async () => {
    const { owner, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(owner);

    await caller.form.archiveForm({ id: form.id });

    const error = await expectRejection(
      caller.form.deleteSubmission({ formId: form.id, submissionId }),
    );
    expect(error.message).toMatch(/archived/i);
  });

  it("drops the cached submission count so the dashboard does not lag", async () => {
    const { owner, form, submissionId } = await castWithOneResponse();
    const caller = await callerFor(owner);

    /* getFormById is the payload that carries the cached count. Warming it
     * first is the point: a stale count is the bug this guards. */
    const before = await caller.form.getFormById({ id: form.id });
    expect(before.submissionsCount).toBe(1);

    await caller.form.deleteSubmission({ formId: form.id, submissionId });

    const after = await caller.form.getFormById({ id: form.id });
    expect(after.submissionsCount).toBe(0);
  });
});

/* ─── Owner-only operations ────────────────────────────────────────────── */

describe("owner-only operations", () => {
  it("let the owner delete", async () => {
    const { owner, form } = await makeCast();
    const caller = await callerFor(owner);

    await caller.form.deleteForm({ id: form.id });

    const rows = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(rows).toHaveLength(0);
  });

  it("refuse an editor", async () => {
    const { editor, form } = await makeCast();
    const caller = await callerFor(editor);

    const error = await expectRejection(caller.form.deleteForm({ id: form.id }));
    expect(error.message).toMatch(/owner access required/i);

    const rows = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(rows, "the form must survive a refused delete").toHaveLength(1);
  });

  it("refuse a viewer and a stranger", async () => {
    const { viewer, stranger, form } = await makeCast();

    for (const person of [viewer, stranger]) {
      const caller = await callerFor(person);
      await expectRejection(caller.form.deleteForm({ id: form.id }));
    }

    const rows = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(rows).toHaveLength(1);
  });

  it("let only the owner archive", async () => {
    const { owner, editor, form } = await makeCast();

    await expectRejection((await callerFor(editor)).form.archiveForm({ id: form.id }));
    await (await callerFor(owner)).form.archiveForm({ id: form.id });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.isArchived).toBe(true);
  });
});

/* ─── Archived forms ───────────────────────────────────────────────────── */

describe("an archived form", () => {
  it("reports a frozen builder to everyone, owner included", async () => {
    const { owner, editor, viewer, form } = await makeCast({ isArchived: true });

    for (const person of [owner, editor, viewer]) {
      const result = await (await callerFor(person)).form.getForm({ id: form.id });
      expect(result.permissions?.builder.canEdit, person.name).toBe(false);
    }
  });

  it("refuses an edit even from its owner", async () => {
    const { owner, form } = await makeCast({ isArchived: true });
    const caller = await callerFor(owner);

    const error = await expectRejection(
      caller.form.createFormField({ formId: form.id, label: "Late addition", type: "TEXT" }),
    );
    expect(error.message).toMatch(/archived/i);
  });

  it("refuses publishing", async () => {
    const { owner, form } = await makeCast({ isArchived: true });
    const error = await expectRejection((await callerFor(owner)).form.publishForm({ id: form.id }));
    expect(error.message).toMatch(/archived/i);
  });

  it("still lets the owner unarchive, which is the one way out", async () => {
    const { owner, form } = await makeCast({ isArchived: true });
    const caller = await callerFor(owner);

    await caller.form.unarchiveForm({ id: form.id });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.isArchived).toBe(false);
  });

  it("does not let an editor unarchive it", async () => {
    const { editor, form } = await makeCast({ isArchived: true });
    const error = await expectRejection(
      (await callerFor(editor)).form.unarchiveForm({ id: form.id }),
    );
    expect(error.message).toMatch(/owner access required/i);
  });
});

/* ─── Public reads ─────────────────────────────────────────────────────── */

describe("form.getFormById — the respondent's view", () => {
  it("serves a published form to a member of the public", async () => {
    const { form } = await makeCast({ isPublished: true });

    const result = await anonymousCaller().form.getFormById({ id: form.id });
    expect(result.id).toBe(form.id);
    expect(Array.isArray(result.fields)).toBe(true);
  });

  it("hides an unpublished form from the public", async () => {
    const { form } = await makeCast();
    await expectRejection(anonymousCaller().form.getFormById({ id: form.id }));
  });

  it("hides an unpublished form from a stranger who is signed in", async () => {
    const { stranger, form } = await makeCast();
    await expectRejection((await callerFor(stranger)).form.getFormById({ id: form.id }));
  });

  it("shows an unpublished form to its builders, so preview works", async () => {
    const { owner, editor, form } = await makeCast();

    for (const person of [owner, editor]) {
      const caller = await callerFor(person);
      await expect(caller.form.getFormById({ id: form.id }), person.name).resolves.toBeDefined();
    }
  });

  it("hides an unpublished form from a viewer, who is not a builder", async () => {
    const { viewer, form } = await makeCast();
    await expectRejection((await callerFor(viewer)).form.getFormById({ id: form.id }));
  });

  it("hides an archived form from everyone, published or not", async () => {
    const { owner, form } = await makeCast({ isArchived: true, isPublished: true });

    await expectRejection(anonymousCaller().form.getFormById({ id: form.id }));
    await expectRejection((await callerFor(owner)).form.getFormById({ id: form.id }));
  });
});

/* ─── Collaborator management ──────────────────────────────────────────── */

describe("collaborators", () => {
  it("are listed with their roles", async () => {
    const { owner, editor, viewer, form } = await makeCast();
    const caller = await callerFor(owner);

    const list = await caller.form.listCollaborators({ formId: form.id });
    const byId = Object.fromEntries(list.map((entry) => [entry.id, entry.role]));

    expect(byId[editor.id]).toBe("editor");
    expect(byId[viewer.id]).toBe("viewer");
    expect(byId[owner.id], "the owner is not a collaborator row").toBeUndefined();
  });

  it("can be added by email", async () => {
    const { owner, form } = await makeCast();
    const newcomer = await makeUser({ name: "Newcomer" });
    const caller = await callerFor(owner);

    await caller.form.addCollaborator({
      formId: form.id,
      email: newcomer.email,
      role: "editor",
    });

    const result = await (await callerFor(newcomer)).form.getForm({ id: form.id });
    expect(result.role).toBe("editor");
  });

  it("cannot be added by an editor — sharing is an owner's right", async () => {
    const { editor, form } = await makeCast();
    const newcomer = await makeUser();

    const error = await expectRejection(
      (await callerFor(editor)).form.addCollaborator({
        formId: form.id,
        email: newcomer.email,
        role: "editor",
      }),
    );
    expect(error.message).toMatch(/owner access required/i);
  });

  it("gain access the moment their role changes", async () => {
    const { owner, viewer, form } = await makeCast();

    const before = await expectRejection(
      (await callerFor(viewer)).form.publishForm({ id: form.id }),
    );
    expect(before.message).toMatch(/editor access required/i);

    await (
      await callerFor(owner)
    ).form.updateCollaboratorRole({
      formId: form.id,
      userId: viewer.id,
      role: "editor",
    });

    await expect(
      (await callerFor(viewer)).form.publishForm({ id: form.id }),
    ).resolves.toBeDefined();
  });

  it("lose access the moment they are removed", async () => {
    const { owner, editor, form } = await makeCast();

    await (
      await callerFor(owner)
    ).form.removeCollaborator({
      formId: form.id,
      userId: editor.id,
    });

    const error = await expectRejection((await callerFor(editor)).form.getForm({ id: form.id }));
    expect(error.message).toMatch(/not found or unauthorized/i);

    const rows = await db
      .select()
      .from(formCollaboratorsTable)
      .where(eq(formCollaboratorsTable.formId, form.id));
    expect(rows.map((row) => row.userId)).not.toContain(editor.id);
  });

  it("cannot be added twice, because the unique index says so", async () => {
    const { owner, editor, form } = await makeCast();
    const caller = await callerFor(owner);

    await expectRejection(
      caller.form.addCollaborator({ formId: form.id, email: editor.email, role: "viewer" }),
    );

    const rows = await db
      .select()
      .from(formCollaboratorsTable)
      .where(eq(formCollaboratorsTable.formId, form.id));
    expect(rows.filter((row) => row.userId === editor.id)).toHaveLength(1);
  });
});

describe("transferring ownership", () => {
  it("moves the form and leaves the old owner without owner rights", async () => {
    const { owner, editor, form } = await makeCast();

    await (
      await callerFor(owner)
    ).form.transferOwnership({
      formId: form.id,
      targetUserId: editor.id,
    });

    const [row] = await db.select().from(formsTable).where(eq(formsTable.id, form.id));
    expect(row?.ownerId).toBe(editor.id);

    const asNewOwner = await (await callerFor(editor)).form.getForm({ id: form.id });
    expect(asNewOwner.role).toBe("owner");

    const error = await expectRejection((await callerFor(owner)).form.deleteForm({ id: form.id }));
    expect(error.message).toMatch(/owner access required/i);
  });

  it("demotes the outgoing owner to editor rather than locking them out", async () => {
    const { owner, editor, form } = await makeCast();

    await (
      await callerFor(owner)
    ).form.transferOwnership({
      formId: form.id,
      targetUserId: editor.id,
    });

    const asOldOwner = await (await callerFor(owner)).form.getForm({ id: form.id });
    expect(asOldOwner.role).toBe("editor");
    expect(asOldOwner.permissions?.builder.canEdit).toBe(true);
  });

  it("clears the new owner's old collaborator row, so they are not both", async () => {
    const { owner, editor, form } = await makeCast();

    await (
      await callerFor(owner)
    ).form.transferOwnership({
      formId: form.id,
      targetUserId: editor.id,
    });

    const rows = await db
      .select()
      .from(formCollaboratorsTable)
      .where(eq(formCollaboratorsTable.formId, form.id));

    expect(rows.filter((row) => row.userId === editor.id)).toHaveLength(0);
  });

  it("refuses a transfer to yourself", async () => {
    const { owner, form } = await makeCast();
    const error = await expectRejection(
      (await callerFor(owner)).form.transferOwnership({
        formId: form.id,
        targetUserId: owner.id,
      }),
    );
    expect(error.message).toMatch(/already the owner/i);
  });

  it("refuses a transfer to a user that does not exist", async () => {
    const { owner, form } = await makeCast();
    const error = await expectRejection(
      (await callerFor(owner)).form.transferOwnership({
        formId: form.id,
        targetUserId: "user_does_not_exist",
      }),
    );
    expect(error.message).toMatch(/target user not found/i);
  });

  it("cannot be done by an editor", async () => {
    const { editor, stranger, form } = await makeCast();

    const error = await expectRejection(
      (await callerFor(editor)).form.transferOwnership({
        formId: form.id,
        targetUserId: stranger.id,
      }),
    );
    expect(error.message).toMatch(/owner access required/i);
  });
});

/* ─── Cross-account isolation ──────────────────────────────────────────── */

describe("two unrelated accounts", () => {
  it("never see each other's forms in a listing", async () => {
    const alice = await makeUser({ name: "Alice" });
    const bob = await makeUser({ name: "Bob" });

    await makeForm(alice, { title: "Alice's form" });
    await makeForm(bob, { title: "Bob's form" });

    const aliceSees = await (await callerFor(alice)).form.listFormsByUserId();
    expect(aliceSees.map((form) => form.title)).toEqual(["Alice's form"]);
  });

  it("see an empty listing rather than someone else's forms", async () => {
    const alice = await makeUser({ name: "Alice" });
    const bob = await makeUser({ name: "Bob" });
    await makeForm(bob, { title: "Bob's form" });

    const result = await (await callerFor(alice)).form.listFormsByUserId();
    expect(result).toEqual([]);
  });

  it("get dashboard statistics counted only from their own forms", async () => {
    const alice = await makeUser({ name: "Alice" });
    const bob = await makeUser({ name: "Bob" });

    await makeForm(alice);
    await makeForm(bob);
    await makeForm(bob);

    const stats = await (await callerFor(alice)).form.getDashboardStats();
    expect(stats.totalSketches).toBe(1);
  });

  it("get dashboard statistics that include forms shared with them", async () => {
    const alice = await makeUser({ name: "Alice" });
    const bob = await makeUser({ name: "Bob" });

    await makeForm(alice, { title: "Alice's own form" });
    const shared = await makeForm(bob, { title: "Bob's shared form" });
    await makeCollaborator(shared, alice, "viewer", bob);
    await makeForm(bob, { title: "Bob's private form" });

    const caller = await callerFor(alice);
    const stats = await caller.form.getDashboardStats();
    const listed = await caller.form.listFormsByUserId();

    expect(stats.totalSketches).toBe(2);
    expect(stats.totalSketches).toBe(listed.length);
    expect(stats.recentForms.map((f) => f.title).sort()).toEqual([
      "Alice's own form",
      "Bob's shared form",
    ]);
  });
});
