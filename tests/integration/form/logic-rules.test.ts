import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@repo/database";
import { formLogicRulesTable, formLogicConditionsTable } from "@repo/database/models/form-logic";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor, expectRejection, type Caller } from "../helpers/caller";
import {
  buildFlow,
  resolveNextStep,
  type FlowField,
  type FlowRule,
  type FlowSegment,
} from "~/lib/form-flow";
import {
  makeCollaborator,
  makeField,
  makeForm,
  makeSegment,
  makeUser,
  type TestForm,
  type TestUser,
} from "../helpers/factories";

let owner: TestUser;

interface Fixture {
  caller: Caller;
  form: TestForm;
  first: string;
  second: string;
  segment: string;
}

async function formWithQuestions(user: TestUser = owner): Promise<Fixture> {
  const form = await makeForm(user, {});
  const segment = await makeSegment(form, { title: "Section", index: "1" });
  const first = await makeField(form, { label: "Do you agree?", type: "RADIO" });
  const second = await makeField(form, { label: "Why?", type: "TEXTAREA" });

  return {
    caller: await callerFor(user),
    form,
    first: first.id,
    second: second.id,
    segment: segment.id,
  };
}

/** The simplest complete rule: if the first question is answered, jump on. */
function jumpRule(fixture: Fixture) {
  return {
    formId: fixture.form.id,
    fieldId: fixture.first,
    action: "JUMP_TO_FIELD" as const,
    targetFieldId: fixture.second,
    conditions: [{ fieldId: fixture.first, operator: "EQUALS" as const, value: "yes" }],
  };
}

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  owner = await makeUser({ name: "Owner" });
});

afterAll(async () => {
  await closeRedis();
  await teardownDatabase();
});

/* ─── Creating ─────────────────────────────────────────────────────────── */

describe("form.createLogicRule", () => {
  it("stores the rule and its conditions", async () => {
    const fixture = await formWithQuestions();

    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.action).toBe("JUMP_TO_FIELD");
    expect(rule?.targetFieldId).toBe(fixture.second);

    const conditions = await db
      .select()
      .from(formLogicConditionsTable)
      .where(eq(formLogicConditionsTable.ruleId, id));
    expect(conditions).toHaveLength(1);
    expect(conditions[0]?.operator).toBe("EQUALS");
    expect(conditions[0]?.value).toBe("yes");
  });

  it("defaults the match mode to ALL", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.match).toBe("ALL");
  });

  it("appends rules on one question with increasing indexes", async () => {
    const fixture = await formWithQuestions();

    await fixture.caller.form.createLogicRule(jumpRule(fixture));
    await fixture.caller.form.createLogicRule({
      ...jumpRule(fixture),
      action: "SUBMIT",
      targetFieldId: null,
    });

    const rules = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.fieldId, fixture.first))
      .orderBy(formLogicRulesTable.index);

    const indexes = rules.map((rule) => Number(rule.index));
    expect(indexes).toHaveLength(2);
    expect(indexes[1]).toBeGreaterThan(indexes[0]!);
  });

  it("stores no value for an operator that does not take one", async () => {
    const fixture = await formWithQuestions();

    const { id } = await fixture.caller.form.createLogicRule({
      ...jumpRule(fixture),
      conditions: [{ fieldId: fixture.first, operator: "IS_NOT_EMPTY" }],
    });

    const [condition] = await db
      .select()
      .from(formLogicConditionsTable)
      .where(eq(formLogicConditionsTable.ruleId, id));
    expect(condition?.value).toBeNull();
  });

  it("accepts a jump to a segment", async () => {
    const fixture = await formWithQuestions();

    const { id } = await fixture.caller.form.createLogicRule({
      formId: fixture.form.id,
      fieldId: fixture.first,
      action: "JUMP_TO_SEGMENT",
      targetSegmentId: fixture.segment,
      conditions: [{ fieldId: fixture.first, operator: "IS_NOT_EMPTY" }],
    });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.targetSegmentId).toBe(fixture.segment);
  });

  it("stores an answer-again branch, which the enum and the check constraint both have to allow", async () => {
    const fixture = await formWithQuestions();

    const { id } = await fixture.caller.form.createLogicRule({
      formId: fixture.form.id,
      fieldId: fixture.first,
      action: "CONTINUE",
      elseAction: "REPEAT",
      conditions: [{ fieldId: fixture.first, operator: "CONTAINS", value: "@company.com" }],
    });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));

    expect(rule?.elseAction).toBe("REPEAT");
    expect(rule?.elseTargetFieldId, "an answer-again branch goes nowhere").toBeNull();
    expect(rule?.elseTargetSegmentId).toBeNull();
  });

  it("refuses an answer-again branch carrying a jump target", async () => {
    const fixture = await formWithQuestions();

    await expectRejection(
      fixture.caller.form.createLogicRule({
        formId: fixture.form.id,
        fieldId: fixture.first,
        action: "REPEAT",
        targetFieldId: fixture.second,
        conditions: [{ fieldId: fixture.first, operator: "IS_NOT_EMPTY" }],
      }),
    );
  });
});

/* ─── The cross-form boundary ──────────────────────────────────────────── */

describe("a rule referencing another form", () => {
  it("cannot jump to a question on someone else's form", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));

    const error = await expectRejection(
      mine.caller.form.createLogicRule({
        ...jumpRule(mine),
        targetFieldId: theirs.second,
      }),
    );

    expect(error.message).toMatch(/belongs to a different form/i);
    expect(await db.select().from(formLogicRulesTable)).toHaveLength(0);
  });

  it("cannot read a question on another form in a condition", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));

    const error = await expectRejection(
      mine.caller.form.createLogicRule({
        ...jumpRule(mine),
        conditions: [{ fieldId: theirs.first, operator: "IS_NOT_EMPTY" }],
      }),
    );
    expect(error.message).toMatch(/belongs to a different form/i);
  });

  it("cannot jump to a segment on another form", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));

    const error = await expectRejection(
      mine.caller.form.createLogicRule({
        formId: mine.form.id,
        fieldId: mine.first,
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: theirs.segment,
        conditions: [{ fieldId: mine.first, operator: "IS_NOT_EMPTY" }],
      }),
    );
    expect(error.message).toMatch(/belongs to a different form/i);
  });

  it("cannot reference a question that has been deleted", async () => {
    const fixture = await formWithQuestions();
    await fixture.caller.form.deleteFormField({ id: fixture.second });

    const error = await expectRejection(fixture.caller.form.createLogicRule(jumpRule(fixture)));
    expect(error.message).toMatch(/no longer exists/i);
  });

  it("cannot be smuggled in through the else branch either", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));

    const error = await expectRejection(
      mine.caller.form.createLogicRule({
        ...jumpRule(mine),
        elseAction: "JUMP_TO_FIELD",
        elseTargetFieldId: theirs.second,
      }),
    );
    expect(error.message).toMatch(/belongs to a different form/i);
  });

  it("cannot be smuggled in through an update", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));
    const { id } = await mine.caller.form.createLogicRule(jumpRule(mine));

    const error = await expectRejection(
      mine.caller.form.updateLogicRule({ id, targetFieldId: theirs.second }),
    );
    expect(error.message).toMatch(/belongs to a different form/i);

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.targetFieldId, "the original target survives").toBe(mine.second);
  });
});

/* ─── Updating ─────────────────────────────────────────────────────────── */

describe("form.updateLogicRule", () => {
  it("changes the action and bumps the version", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    const result = await fixture.caller.form.updateLogicRule({ id, action: "SUBMIT" });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.action).toBe("SUBMIT");
    expect(result.version).toBe(1);
  });

  it("clears a stale target when the action no longer needs one", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.updateLogicRule({ id, action: "SUBMIT" });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.targetFieldId, "SUBMIT ends the flow, so a target would be nonsense").toBeNull();
    expect(rule?.targetSegmentId).toBeNull();
  });

  it("clears a stale target when switching to answer-again", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.updateLogicRule({ id, action: "REPEAT" });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.action).toBe("REPEAT");
    expect(rule?.targetFieldId).toBeNull();
    expect(rule?.targetSegmentId).toBeNull();
  });

  it("clears the field target when switching to a segment jump", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.updateLogicRule({
      id,
      action: "JUMP_TO_SEGMENT",
      targetSegmentId: fixture.segment,
    });

    const [rule] = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    expect(rule?.targetFieldId).toBeNull();
    expect(rule?.targetSegmentId).toBe(fixture.segment);
  });

  it("replaces the conditions wholesale rather than appending", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule({
      ...jumpRule(fixture),
      conditions: [
        { fieldId: fixture.first, operator: "EQUALS", value: "yes" },
        { fieldId: fixture.second, operator: "IS_NOT_EMPTY" },
      ],
    });

    await fixture.caller.form.updateLogicRule({
      id,
      conditions: [{ fieldId: fixture.first, operator: "EQUALS", value: "no" }],
    });

    const conditions = await db
      .select()
      .from(formLogicConditionsTable)
      .where(eq(formLogicConditionsTable.ruleId, id));
    expect(conditions).toHaveLength(1);
    expect(conditions[0]?.value).toBe("no");
  });

  it("leaves the conditions alone when the update does not mention them", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.updateLogicRule({ id, match: "ANY" });

    const conditions = await db
      .select()
      .from(formLogicConditionsTable)
      .where(eq(formLogicConditionsTable.ruleId, id));
    expect(conditions).toHaveLength(1);
  });

  it("refuses an update built on a stale version", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.updateLogicRule({ id, match: "ANY" });

    const error = await expectRejection(
      fixture.caller.form.updateLogicRule({ id, match: "ALL", expectedVersion: 0 }),
    );
    expect(error.message).toMatch(/modified by someone else/i);
  });

  it("accepts an update carrying the current version", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await expect(
      fixture.caller.form.updateLogicRule({ id, match: "ANY", expectedVersion: 0 }),
    ).resolves.toMatchObject({ version: 1 });
  });

  it("refuses a rule that does not exist", async () => {
    const fixture = await formWithQuestions();
    const error = await expectRejection(
      fixture.caller.form.updateLogicRule({
        id: "00000000-0000-4000-8000-000000000000",
        match: "ANY",
      }),
    );
    expect(error.message).toMatch(/not found/i);
  });
});

/* ─── Listing and deleting ─────────────────────────────────────────────── */

describe("form.listLogicRules", () => {
  it("returns each rule with its conditions attached", async () => {
    const fixture = await formWithQuestions();
    await fixture.caller.form.createLogicRule({
      ...jumpRule(fixture),
      conditions: [
        { fieldId: fixture.first, operator: "EQUALS", value: "yes" },
        { fieldId: fixture.second, operator: "IS_NOT_EMPTY" },
      ],
    });

    const rules = await fixture.caller.form.listLogicRules({ formId: fixture.form.id });

    expect(rules).toHaveLength(1);
    expect(rules[0]?.conditions).toHaveLength(2);
  });

  it("hands an answer-again branch back the way the flow engine expects it", async () => {
    /* The renderer builds its flow from this payload, so REPEAT has to survive
     * the round trip with both targets null — the engine reads a target on a
     * targetless action as a jump. */
    const fixture = await formWithQuestions();
    await fixture.caller.form.createLogicRule({
      formId: fixture.form.id,
      fieldId: fixture.first,
      action: "CONTINUE",
      elseAction: "REPEAT",
      conditions: [{ fieldId: fixture.first, operator: "CONTAINS", value: "@company.com" }],
    });

    const [rule] = await fixture.caller.form.listLogicRules({ formId: fixture.form.id });

    expect(rule?.action).toBe("CONTINUE");
    expect(rule?.elseAction).toBe("REPEAT");
    expect(rule?.elseTargetFieldId).toBeNull();
    expect(rule?.elseTargetSegmentId).toBeNull();
    expect(rule?.conditions).toHaveLength(1);
  });

  it("never returns another form's rules", async () => {
    const mine = await formWithQuestions();
    const theirs = await formWithQuestions(await makeUser({ name: "Someone else" }));
    await theirs.caller.form.createLogicRule(jumpRule(theirs));

    expect(await mine.caller.form.listLogicRules({ formId: mine.form.id })).toEqual([]);
  });
});

describe("form.deleteLogicRule", () => {
  it("removes the rule and its conditions together", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.deleteLogicRule({ id });

    expect(await db.select().from(formLogicRulesTable)).toHaveLength(0);
    expect(
      await db.select().from(formLogicConditionsTable),
      "conditions must not outlive their rule",
    ).toHaveLength(0);
  });

  it("leaves another rule on the same question alone", async () => {
    const fixture = await formWithQuestions();
    const first = await fixture.caller.form.createLogicRule(jumpRule(fixture));
    await fixture.caller.form.createLogicRule({
      ...jumpRule(fixture),
      action: "SUBMIT",
      targetFieldId: null,
    });

    await fixture.caller.form.deleteLogicRule({ id: first.id });

    expect(await db.select().from(formLogicRulesTable)).toHaveLength(1);
  });

  it("removes rules when the question they hang off is deleted", async () => {
    const fixture = await formWithQuestions();
    await fixture.caller.form.createLogicRule(jumpRule(fixture));

    await fixture.caller.form.deleteFormField({ id: fixture.first });

    expect(await db.select().from(formLogicRulesTable)).toHaveLength(0);
    expect(await db.select().from(formLogicConditionsTable)).toHaveLength(0);
  });
});

/* ─── Permissions ──────────────────────────────────────────────────────── */

describe("who may change branching", () => {
  it("an editor may", async () => {
    const fixture = await formWithQuestions();
    const editor = await makeUser({ name: "Editor" });
    await makeCollaborator(fixture.form, editor, "editor", owner);

    const asEditor = await callerFor(editor);
    await expect(asEditor.form.createLogicRule(jumpRule(fixture))).resolves.toBeDefined();
  });

  it("a viewer may not", async () => {
    const fixture = await formWithQuestions();
    const viewer = await makeUser({ name: "Viewer" });
    await makeCollaborator(fixture.form, viewer, "viewer", owner);

    const asViewer = await callerFor(viewer);
    const error = await expectRejection(asViewer.form.createLogicRule(jumpRule(fixture)));
    expect(error.message).toMatch(/editor access required/i);
  });

  it("a stranger may not, and cannot delete one either", async () => {
    const fixture = await formWithQuestions();
    const { id } = await fixture.caller.form.createLogicRule(jumpRule(fixture));

    const stranger = await callerFor(await makeUser({ name: "Stranger" }));
    await expectRejection(stranger.form.createLogicRule(jumpRule(fixture)));
    await expectRejection(stranger.form.deleteLogicRule({ id }));

    expect(await db.select().from(formLogicRulesTable)).toHaveLength(1);
  });

  it("nobody may, on an archived form", async () => {
    const fixture = await formWithQuestions();
    await fixture.caller.form.archiveForm({ id: fixture.form.id });

    const error = await expectRejection(fixture.caller.form.createLogicRule(jumpRule(fixture)));
    expect(error.message).toMatch(/archived/i);
  });
});

/* ─── The rule as a respondent meets it ────────────────────────────────── */

describe("a stored branch, run by the flow engine", () => {
  async function publishedWithGate() {
    const form = await makeForm(owner, { isPublished: true });
    const email = await makeField(form, { label: "Work email", type: "EMAIL" });
    const role = await makeField(form, { label: "Your role", type: "TEXT" });
    const caller = await callerFor(owner);

    await caller.form.createLogicRule({
      formId: form.id,
      fieldId: email.id,
      action: "CONTINUE",
      elseAction: "REPEAT",
      conditions: [{ fieldId: email.id, operator: "CONTAINS", value: "@company.com" }],
    });

    const bundle = await anonymousCaller().form.getFormById({ id: form.id });

    return {
      email: email.id,
      role: role.id,
      flow: buildFlow(
        bundle.fields as FlowField[],
        (bundle.segments ?? []) as FlowSegment[],
        (bundle.logicRules ?? []) as FlowRule[],
      ),
    };
  }

  it("sends a wrong answer back to the same question", async () => {
    const { email, flow } = await publishedWithGate();

    expect(
      resolveNextStep({ flow, answers: { [email]: "someone@gmail.com" }, fromFieldId: email }),
    ).toEqual({ kind: "repeat", fieldId: email });
  });

  it("lets a right answer through to the next question", async () => {
    const { email, role, flow } = await publishedWithGate();

    expect(
      resolveNextStep({ flow, answers: { [email]: "someone@company.com" }, fromFieldId: email }),
    ).toEqual({ kind: "field", fieldId: role });
  });

  it("keeps asking rather than ending the form on a second wrong attempt", async () => {
    /* The visited guard ends the form for a backwards jump. A repeat must not
     * go through it, or a second bad answer would silently submit. */
    const { email, flow } = await publishedWithGate();

    expect(
      resolveNextStep({
        flow,
        answers: { [email]: "still-wrong" },
        fromFieldId: email,
        visited: [email],
      }),
    ).toEqual({ kind: "repeat", fieldId: email });
  });
});
