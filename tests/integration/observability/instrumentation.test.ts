import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { register } from "@repo/observability";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, expectRejection } from "../helpers/caller";
import { makeField, makeForm, makeUser, type TestUser } from "../helpers/factories";

/* Instrumentation, exercised through the real code path.
 *
 * The unit tests in packages/observability prove the recording functions
 * behave. They cannot prove the call sites fire — that submitForm actually
 * counts, that a rejection is classified rather than swallowed, or that the
 * label stays inside its closed set when a real TRPCError comes back.
 *
 * That gap matters more here than usual: a counter that is never incremented
 * looks exactly like a quiet system. There is nothing to notice. */

async function counter(name: string, labels: Record<string, string>): Promise<number> {
  const metric = await register.getSingleMetric(name)?.get();
  const found = metric?.values.find((v: { labels: Record<string, unknown>; value: number }) =>
    Object.entries(labels).every(([k, expected]) => v.labels[k] === expected),
  );
  return found?.value ?? 0;
}

let owner: TestUser;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  register.resetMetrics();
  owner = await makeUser({ name: "Owner" });
});

afterAll(async () => {
  await closeRedis();
  await teardownDatabase();
});

describe("form.submitForm", () => {
  it("counts an accepted submission", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form, { label: "How was it?" });

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: field.id, value: "Good" }],
    });

    expect(await counter("canvasflow_form_submissions_total", { result: "accepted" })).toBe(1);
  });

  /* The submission that matters: someone filled the form in and lost it. The
   * answers are gone with the page, so this is the one product failure with no
   * second chance — and until this counter existed it produced no signal.
   *
   * Asserting the exact reason, not just that something was counted: the first
   * version of the classifier read TRPCError codes, the service throws plain
   * Errors, and every rejection was silently labelled "unknown". A counter
   * that increments with a useless label passes a weaker test and tells you
   * nothing on the dashboard. */
  it("counts an unpublished form as closed, not unknown", async () => {
    const form = await makeForm(owner);
    const field = await makeField(form);

    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );

    expect(
      await counter("canvasflow_form_submissions_total", {
        result: "rejected",
        reason: "closed",
      }),
    ).toBe(1);
    expect(await counter("canvasflow_form_submissions_total", { result: "accepted" })).toBe(0);
  });

  it("counts a missing form as not_found", async () => {
    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: "00000000-0000-4000-8000-000000000000",
        values: [],
      }),
    );

    expect(
      await counter("canvasflow_form_submissions_total", {
        result: "rejected",
        reason: "not_found",
      }),
    ).toBe(1);
  });

  it("counts a closed form as closed", async () => {
    const form = await makeForm(owner, { isPublished: true, isOpen: false });
    const field = await makeField(form);

    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );

    expect(
      await counter("canvasflow_form_submissions_total", {
        result: "rejected",
        reason: "closed",
      }),
    ).toBe(1);
  });

  /* Nothing may be labelled "unknown" for a rejection the product raises on
   * purpose — that label is reserved for genuine surprises. */
  it("labels no deliberate rejection as unknown", async () => {
    const form = await makeForm(owner);
    const field = await makeField(form);

    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );

    expect(await counter("canvasflow_form_submissions_total", { reason: "unknown" })).toBe(0);
  });

  /* A raw error message as a label would carry form names and ids, and one
   * series per distinct message is how a metrics backend runs out of memory. */
  it("never lets a raw error message become a label", async () => {
    const form = await makeForm(owner);
    const field = await makeField(form);

    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );

    const allowed = new Set([
      "ok",
      "closed",
      "validation",
      "not_found",
      "forbidden",
      "rate_limited",
      "already_responded",
      "internal",
      "unknown",
    ]);

    const metric = await register.getSingleMetric("canvasflow_form_submissions_total")?.get();
    for (const value of metric?.values ?? []) {
      expect(allowed, `unexpected reason label: ${String(value.labels.reason)}`).toContain(
        value.labels.reason,
      );
    }
  });

  it("does not count a submission twice when it succeeds", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form);

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: field.id, value: "a" }],
    });

    const total = (
      await register.getSingleMetric("canvasflow_form_submissions_total")?.get()
    )?.values.reduce((sum, v) => sum + v.value, 0);

    expect(total).toBe(1);
  });

  /* Instrumentation must never change behaviour. The try/catch around the
   * recording site rethrows, and this pins that it rethrows the original. */
  it("rethrows the original error rather than swallowing it", async () => {
    const form = await makeForm(owner);
    const field = await makeField(form);

    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );

    expect(error.message).toMatch(/not published/i);
  });
});

/* db is imported for its side effect of pinning the test database connection;
 * referencing it keeps the import honest. */
void db;
