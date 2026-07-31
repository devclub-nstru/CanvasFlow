import { db, eq, inArray, max } from "@repo/database";
import { formLogicRulesTable, formLogicConditionsTable } from "@repo/database/models/form-logic";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSegmentsTable } from "@repo/database/models/form-segment";
import { requireEditor } from "../form";
import {
  createLogicRuleInput,
  type CreateLogicRuleInputType,
  updateLogicRuleInput,
  type UpdateLogicRuleInputType,
  deleteLogicRuleInput,
  type DeleteLogicRuleInputType,
  listLogicRulesInput,
  type ListLogicRulesInputType,
  logicConditionInput,
  type LogicConditionInputType,
  VALUELESS_OPERATORS,
  assertConditionShape,
  assertRuleShape,
  type LogicAction,
  type LogicMatch,
} from "./model";

/** A rule row with its conditions attached, ordered for display. */
type RuleWithConditions = typeof formLogicRulesTable.$inferSelect & {
  conditions: Array<typeof formLogicConditionsTable.$inferSelect>;
};

class FormLogicService {
  /**
   * Attach conditions to rule rows.
   *
   * One `IN (...)` query for the whole batch rather than one per rule: a form
   * with twenty branches would otherwise turn a single list into twenty-one
   * round-trips, and this runs on the public form read that every respondent
   * pays for.
   */
  private async withConditions(
    rules: Array<typeof formLogicRulesTable.$inferSelect>,
  ): Promise<RuleWithConditions[]> {
    if (rules.length === 0) return [];

    const conditions = await db
      .select()
      .from(formLogicConditionsTable)
      .where(
        inArray(
          formLogicConditionsTable.ruleId,
          rules.map((r) => r.id),
        ),
      )
      .orderBy(formLogicConditionsTable.index);

    const byRuleId = new Map<string, Array<typeof formLogicConditionsTable.$inferSelect>>();
    for (const condition of conditions) {
      const list = byRuleId.get(condition.ruleId);
      if (list) list.push(condition);
      else byRuleId.set(condition.ruleId, [condition]);
    }

    return rules.map((rule) => ({ ...rule, conditions: byRuleId.get(rule.id) ?? [] }));
  }

  /**
   * Every question and segment a rule points at — as a condition source or as
   * a destination — has to live in the same form as the rule.
   *
   * The FK columns guarantee the rows exist; only this guarantees they're in
   * scope. Without it an editor with access to form A could read an answer
   * from form B, leaking B's structure into A's routing.
   *
   * Both id sets are checked in one query each, so adding a fifth condition
   * doesn't add a fifth round-trip.
   */
  private async assertReferencesBelongToForm(
    formId: string,
    fieldIds: Array<string | null | undefined>,
    segmentIds: Array<string | null | undefined>,
  ): Promise<void> {
    const fields = [...new Set(fieldIds.filter((id): id is string => !!id))];
    const segments = [...new Set(segmentIds.filter((id): id is string => !!id))];

    if (fields.length > 0) {
      const rows = await db
        .select({ id: formFieldsTable.id, formId: formFieldsTable.formId })
        .from(formFieldsTable)
        .where(inArray(formFieldsTable.id, fields));

      if (rows.length !== fields.length) throw new Error("A referenced question no longer exists");
      const stray = rows.find((r) => r.formId !== formId);
      if (stray) throw new Error("A referenced question belongs to a different form");
    }

    if (segments.length > 0) {
      const rows = await db
        .select({ id: formSegmentsTable.id, formId: formSegmentsTable.formId })
        .from(formSegmentsTable)
        .where(inArray(formSegmentsTable.id, segments));

      if (rows.length !== segments.length) throw new Error("A referenced segment no longer exists");
      const stray = rows.find((r) => r.formId !== formId);
      if (stray) throw new Error("A referenced segment belongs to a different form");
    }
  }

  /** Normalise a condition for storage: SQL NULL (not JSON null) when the
   *  operator takes no operand, since the CHECK tests `value IS NULL`. */
  private conditionValues(ruleId: string, conditions: LogicConditionInputType[]) {
    return conditions.map((condition, i) => ({
      ruleId,
      fieldId: condition.fieldId,
      operator: condition.operator,
      value: VALUELESS_OPERATORS.includes(condition.operator) ? null : (condition.value ?? null),
      index: condition.index ?? String(i + 1),
    }));
  }

  public async createLogicRule(payload: CreateLogicRuleInputType & { userId: string }) {
    const {
      formId,
      fieldId,
      match,
      conditions,
      action,
      targetFieldId,
      targetSegmentId,
      elseAction,
      elseTargetFieldId,
      elseTargetSegmentId,
      index: clientIndex,
    } = await createLogicRuleInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    // Pairing rules live here rather than in the Zod schema — a refined input
    // schema breaks OpenAPI generation for the whole API. See the note on
    // assertConditionShape.
    assertRuleShape({
      fieldId,
      action,
      targetFieldId,
      targetSegmentId,
      elseAction,
      elseTargetFieldId,
      elseTargetSegmentId,
    });
    conditions.forEach(assertConditionShape);

    await this.assertReferencesBelongToForm(
      formId,
      [fieldId, targetFieldId, elseTargetFieldId, ...conditions.map((c) => c.fieldId)],
      [targetSegmentId, elseTargetSegmentId],
    );

    let index = clientIndex;
    if (index === undefined) {
      const rows = await db
        .select({ maxIndex: max(formLogicRulesTable.index) })
        .from(formLogicRulesTable)
        .where(eq(formLogicRulesTable.fieldId, fieldId));
      const current = rows[0]?.maxIndex;
      index = String(current ? parseFloat(current) + 1 : 1);
    }

    // Rule and conditions are one unit. A rule that committed without its
    // conditions would be a branch that never matches, silently changing the
    // form's routing — worse than the create failing outright.
    return db.transaction(async (tx) => {
      const insertResult = await tx
        .insert(formLogicRulesTable)
        .values({
          formId,
          fieldId,
          match,
          action,
          targetFieldId: targetFieldId || null,
          targetSegmentId: targetSegmentId || null,
          elseAction: elseAction || null,
          elseTargetFieldId: elseTargetFieldId || null,
          elseTargetSegmentId: elseTargetSegmentId || null,
          index: index as string,
        })
        .returning({ id: formLogicRulesTable.id, index: formLogicRulesTable.index });

      const created = insertResult[0];
      if (!created?.id) throw new Error("Failed to create branching rule");

      if (conditions.length > 0) {
        await tx
          .insert(formLogicConditionsTable)
          .values(this.conditionValues(created.id, conditions));
      }

      return { id: created.id, index: created.index };
    });
  }

  public async updateLogicRule(payload: UpdateLogicRuleInputType & { userId: string }) {
    const {
      id,
      match,
      conditions,
      action,
      targetFieldId,
      targetSegmentId,
      elseAction,
      elseTargetFieldId,
      elseTargetSegmentId,
      index,
      expectedVersion,
    } = await updateLogicRuleInput.parseAsync(payload);

    const existingResult = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    const existing = existingResult[0];
    if (!existing) throw new Error("Branching rule not found");

    await requireEditor(existing.formId, payload.userId);

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error(
        `Branching rule was modified by someone else (expected version ${expectedVersion}, got ${existing.version}). Reload and try again.`,
      );
    }

    /* Merge the patch onto the stored row before validating. A partial update
     * only carries what the author touched, so the then/else pairings are only
     * meaningful once applied on top of what's already there. */
    const nextMatch: LogicMatch = (match ?? existing.match) as LogicMatch;
    const nextAction: LogicAction = (action ?? existing.action) as LogicAction;
    const nextElseAction: LogicAction | null =
      elseAction !== undefined
        ? (elseAction as LogicAction | null)
        : (existing.elseAction as LogicAction | null);

    let nextTargetFieldId = targetFieldId !== undefined ? targetFieldId : existing.targetFieldId;
    let nextTargetSegmentId =
      targetSegmentId !== undefined ? targetSegmentId : existing.targetSegmentId;
    let nextElseTargetFieldId =
      elseTargetFieldId !== undefined ? elseTargetFieldId : existing.elseTargetFieldId;
    let nextElseTargetSegmentId =
      elseTargetSegmentId !== undefined ? elseTargetSegmentId : existing.elseTargetSegmentId;

    // Switching a side's action invalidates the target the other kind of
    // action used. Clearing it here rather than erroring keeps the editor's
    // flow simple: pick a different action, pick its target, save.
    if (nextAction === "JUMP_TO_FIELD") nextTargetSegmentId = null;
    if (nextAction === "JUMP_TO_SEGMENT") nextTargetFieldId = null;
    if (nextAction === "SUBMIT" || nextAction === "CONTINUE") {
      nextTargetFieldId = null;
      nextTargetSegmentId = null;
    }
    if (nextElseAction === "JUMP_TO_FIELD") nextElseTargetSegmentId = null;
    if (nextElseAction === "JUMP_TO_SEGMENT") nextElseTargetFieldId = null;
    if (!nextElseAction || nextElseAction === "SUBMIT" || nextElseAction === "CONTINUE") {
      nextElseTargetFieldId = null;
      nextElseTargetSegmentId = null;
    }

    assertRuleShape({
      fieldId: existing.fieldId,
      action: nextAction,
      targetFieldId: nextTargetFieldId,
      targetSegmentId: nextTargetSegmentId,
      elseAction: nextElseAction,
      elseTargetFieldId: nextElseTargetFieldId,
      elseTargetSegmentId: nextElseTargetSegmentId,
    });

    let parsedConditions: LogicConditionInputType[] | undefined;
    if (conditions !== undefined) {
      parsedConditions = await Promise.all(
        conditions.map((condition) => logicConditionInput.parseAsync(condition)),
      );
      parsedConditions.forEach(assertConditionShape);
    }

    await this.assertReferencesBelongToForm(
      existing.formId,
      [
        nextTargetFieldId,
        nextElseTargetFieldId,
        ...(parsedConditions?.map((c) => c.fieldId) ?? []),
      ],
      [nextTargetSegmentId, nextElseTargetSegmentId],
    );

    return db.transaction(async (tx) => {
      const updateResult = await tx
        .update(formLogicRulesTable)
        .set({
          match: nextMatch,
          action: nextAction,
          targetFieldId: nextTargetFieldId,
          targetSegmentId: nextTargetSegmentId,
          elseAction: nextElseAction,
          elseTargetFieldId: nextElseTargetFieldId,
          elseTargetSegmentId: nextElseTargetSegmentId,
          ...(index !== undefined ? { index } : {}),
          version: existing.version + 1,
        })
        .where(eq(formLogicRulesTable.id, id))
        .returning({ id: formLogicRulesTable.id, version: formLogicRulesTable.version });

      const updated = updateResult[0];
      if (!updated?.id) throw new Error("Update raced with another change — please retry");

      /* Conditions are replaced wholesale rather than diffed. The set is small
       * and always edited as a group, and delete-then-insert inside the
       * transaction is both simpler and immune to the ordering bugs a
       * three-way diff invites. Omitting `conditions` leaves them alone. */
      if (parsedConditions !== undefined) {
        await tx.delete(formLogicConditionsTable).where(eq(formLogicConditionsTable.ruleId, id));

        if (parsedConditions.length > 0) {
          await tx
            .insert(formLogicConditionsTable)
            .values(this.conditionValues(id, parsedConditions));
        }
      }

      return { id: updated.id, version: updated.version };
    });
  }

  public async deleteLogicRule(payload: DeleteLogicRuleInputType & { userId: string }) {
    const { id } = await deleteLogicRuleInput.parseAsync(payload);

    const existingResult = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id));
    const existing = existingResult[0];
    if (!existing) throw new Error("Branching rule not found");

    await requireEditor(existing.formId, payload.userId);

    // Conditions go with it via ON DELETE CASCADE on `rule_id`.
    const deleteResult = await db
      .delete(formLogicRulesTable)
      .where(eq(formLogicRulesTable.id, id))
      .returning({ id: formLogicRulesTable.id });

    if (!deleteResult[0]?.id) {
      throw new Error("Failed to delete branching rule or rule not found");
    }

    return { success: true };
  }

  public async listLogicRules(payload: ListLogicRulesInputType & { userId: string }) {
    const { formId } = await listLogicRulesInput.parseAsync(payload);

    await requireEditor(formId, payload.userId);

    const rules = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.formId, formId))
      .orderBy(formLogicRulesTable.index);

    return this.withConditions(rules);
  }

  /** Unauthenticated read for the public form renderer, which needs the rules
   *  to know where each answer leads. Access control is the caller's job —
   *  `getFormById` is already public. */
  public async listRulesForPublicForm(formId: string) {
    const rules = await db
      .select()
      .from(formLogicRulesTable)
      .where(eq(formLogicRulesTable.formId, formId))
      .orderBy(formLogicRulesTable.index);

    return this.withConditions(rules);
  }
}

export default FormLogicService;
