import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor } from "../helpers/caller";
import { makeField, makeForm, makeUser, type TestForm, type TestUser } from "../helpers/factories";
import { buildResponsesCsv } from "~/lib/csv";

let owner: TestUser;

interface Fixture {
  form: TestForm;
  fields: Array<{ id: string; label: string; type: string }>;
}

async function surveyForm(): Promise<Fixture> {
  const form = await makeForm(owner, { isPublished: true, title: "Q4 Feedback" });

  const name = await makeField(form, { label: "Your name", type: "TEXT" });
  const toppings = await makeField(form, { label: "Toppings, please", type: "CHECKBOX" });
  const agreed = await makeField(form, { label: "Agreed?", type: "TOGGLE" });

  return {
    form,
    fields: [
      { id: name.id, label: "Your name", type: "TEXT" },
      { id: toppings.id, label: "Toppings, please", type: "CHECKBOX" },
      { id: agreed.id, label: "Agreed?", type: "TOGGLE" },
    ],
  };
}

/** Minimal RFC 4180 reader, so the assertions are about columns not substrings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }

  row.push(cell);
  rows.push(row);
  return rows;
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

describe("exporting real responses", () => {
  it("builds a file whose every row has the header's columns", async () => {
    const { form, fields } = await surveyForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [
        { formFieldId: fields[0]!.id, value: 'Ada, "the" first' },
        { formFieldId: fields[1]!.id, value: ["Olives", "Basil"] },
        { formFieldId: fields[2]!.id, value: true },
      ],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });

    const rows = parseCsv(buildResponsesCsv(fields, submissions));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      "Submission ID",
      "Submitted At",
      "Respondent Email",
      "Device Type",
      "Your name",
      "Toppings, please",
      "Agreed?",
    ]);
    expect(rows[1]).toHaveLength(rows[0]!.length);
  });

  it("carries each answer through in the shape a reader expects", async () => {
    const { form, fields } = await surveyForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [
        { formFieldId: fields[0]!.id, value: 'Ada, "the" first' },
        { formFieldId: fields[1]!.id, value: ["Olives", "Basil"] },
        { formFieldId: fields[2]!.id, value: true },
      ],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });
    const [, row] = parseCsv(buildResponsesCsv(fields, submissions));

    expect(row![4]).toBe('Ada, "the" first');
    expect(row![5], "a multi-select reads as a list, not JSON").toBe("Olives, Basil");
    expect(row![6], "a toggle reads as a word, not true/false").toBe("Yes");
  });

  it("stamps the row with the submission's real id and time", async () => {
    const { form, fields } = await surveyForm();

    const { id } = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fields[0]!.id, value: "Ada" }],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });
    const [, row] = parseCsv(buildResponsesCsv(fields, submissions));

    expect(row![0]).toBe(id);
    expect(row![1], "ISO 8601, so the cell sorts and carries no comma").toMatch(
      /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
    );
  });

  it("leaves a skipped question blank instead of shifting the columns", async () => {
    const { form, fields } = await surveyForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fields[1]!.id, value: ["Olives"] }],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });
    const [header, row] = parseCsv(buildResponsesCsv(fields, submissions));

    expect(row).toHaveLength(header!.length);
    expect(row![4]).toBe("");
    expect(row![5]).toBe("Olives");
  });

  it("names the respondent when the form collects addresses", async () => {
    /* collectRespondentEmail is what puts an address on the row — and it
     * implies sign-in, so this form takes no anonymous answers. */
    const form = await makeForm(owner, { isPublished: true, collectRespondentEmail: true });
    const field = await makeField(form, { label: "Your name", type: "TEXT" });
    const fields = [{ id: field.id, label: "Your name", type: "TEXT" }];
    const responder = await makeUser({ name: "Grace" });

    await (
      await callerFor(responder)
    ).form.submitForm({
      formId: form.id,
      values: [{ formFieldId: field.id, value: "Grace" }],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });
    const [, row] = parseCsv(buildResponsesCsv(fields, submissions));

    expect(row![2]).toBe(responder.email);
  });

  it("falls back to Anonymous on a form that does not collect them", async () => {
    const { form, fields } = await surveyForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fields[0]!.id, value: "Nobody" }],
    });

    const { submissions } = await (await callerFor(owner)).form.getSubmissions({ formId: form.id });
    const [, row] = parseCsv(buildResponsesCsv(fields, submissions));

    expect(row![2]).toBe("Anonymous");
  });

  it("covers every response, not just the first page the table loaded", async () => {
    const { form, fields } = await surveyForm();
    const caller = await callerFor(owner);

    for (let i = 0; i < 5; i++) {
      await anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fields[0]!.id, value: `respondent ${i}` }],
      });
      /* createdAt is the cursor, so the rows need distinguishable timestamps. */
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    /* Two at a time, drained the way the export drains it in the browser. */
    const collected: Awaited<ReturnType<typeof caller.form.getSubmissions>>["submissions"] = [];
    let cursor: string | null = null;
    do {
      const page = await caller.form.getSubmissions({ formId: form.id, limit: 2, cursor });
      collected.push(...page.submissions);
      cursor = page.nextCursor;
    } while (cursor !== null);

    const rows = parseCsv(buildResponsesCsv(fields, collected));

    expect(rows).toHaveLength(6);
    expect(new Set(rows.slice(1).map((row) => row[0])).size, "no row twice").toBe(5);
    expect(
      rows
        .slice(1)
        .map((row) => row[4])
        .sort(),
    ).toEqual(["respondent 0", "respondent 1", "respondent 2", "respondent 3", "respondent 4"]);
  });

  it("does not leak a response belonging to another form", async () => {
    const mine = await surveyForm();
    const theirs = await surveyForm();

    await anonymousCaller().form.submitForm({
      formId: theirs.form.id,
      values: [{ formFieldId: theirs.fields[0]!.id, value: "not mine" }],
    });
    await anonymousCaller().form.submitForm({
      formId: mine.form.id,
      values: [{ formFieldId: mine.fields[0]!.id, value: "mine" }],
    });

    const { submissions } = await (
      await callerFor(owner)
    ).form.getSubmissions({ formId: mine.form.id });
    const csv = buildResponsesCsv(mine.fields, submissions);

    expect(csv).toContain("mine");
    expect(csv).not.toContain("not mine");
  });
});

describe("the database the export reads from", () => {
  it("is the same one the count on the dashboard comes from", async () => {
    const { form, fields } = await surveyForm();
    const caller = await callerFor(owner);

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fields[0]!.id, value: "Ada" }],
    });

    const { submissions } = await caller.form.getSubmissions({ formId: form.id });
    const detail = await caller.form.getFormById({ id: form.id });

    expect(parseCsv(buildResponsesCsv(fields, submissions))).toHaveLength(
      (detail.submissionsCount ?? 0) + 1,
    );
  });
});
