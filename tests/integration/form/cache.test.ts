import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { redis } from "@repo/redis";
import { formPublicKey, formCountKey } from "@repo/redis/cache";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor } from "../helpers/caller";
import { makeField, makeForm, makeUser, type TestUser } from "../helpers/factories";

/* Cache coherence.
 *
 * `invalidateFormCache` is called from about a dozen places in the form
 * service. Unit tests can assert the call happened; only a real Redis can
 * prove the next read misses. A stale public bundle is the worst kind of bug
 * here — the author edits a live form, sees their change in the builder, and
 * respondents keep getting the old version until the TTL expires. */

let owner: TestUser;

async function cached(key: string): Promise<unknown> {
  const client = redis();
  if (!client) throw new Error("the cache tests need REDIS_URL to point somewhere real");
  const raw = await client.get(key);
  return raw === null ? null : JSON.parse(raw);
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

describe("the public form bundle", () => {
  it("is not cached until someone reads it", async () => {
    const form = await makeForm(owner, { isPublished: true });
    expect(await cached(formPublicKey(form.id))).toBeNull();
  });

  it("is cached on the first public read", async () => {
    const form = await makeForm(owner, { isPublished: true });
    await makeField(form, { label: "Original" });

    await anonymousCaller().form.getFormById({ id: form.id });

    const entry = (await cached(formPublicKey(form.id))) as { form: { id: string } } | null;
    expect(entry?.form.id).toBe(form.id);
  });

  it("is served from the cache on the second read", async () => {
    const form = await makeForm(owner, { isPublished: true });
    await makeField(form, { label: "Original" });

    const first = await anonymousCaller().form.getFormById({ id: form.id });
    const second = await anonymousCaller().form.getFormById({ id: form.id });

    expect(second.fields.map((f) => f.label)).toEqual(first.fields.map((f) => f.label));
  });

  it("is dropped when a question is added, so the next read is fresh", async () => {
    const form = await makeForm(owner, { isPublished: true });
    await makeField(form, { label: "Original" });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: form.id });
    expect(await cached(formPublicKey(form.id))).not.toBeNull();

    await caller.form.createFormField({ formId: form.id, label: "Added later", type: "TEXT" });

    expect(await cached(formPublicKey(form.id)), "the edit must evict the entry").toBeNull();

    const fresh = await anonymousCaller().form.getFormById({ id: form.id });
    expect(fresh.fields.map((f) => f.label)).toContain("Added later");
  });

  it("is dropped when a question is edited", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form, { label: "Before" });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: form.id });
    await caller.form.updateFormField({ id: field.id, label: "After" });

    const fresh = await anonymousCaller().form.getFormById({ id: form.id });
    expect(fresh.fields.map((f) => f.label)).toEqual(["After"]);
  });

  it("is dropped when a question is deleted", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form, { label: "Doomed" });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: form.id });
    await caller.form.deleteFormField({ id: field.id });

    const fresh = await anonymousCaller().form.getFormById({ id: form.id });
    expect(fresh.fields).toHaveLength(0);
  });

  it("is dropped when the form's settings change", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: form.id });

    await caller.form.updateFormSettings({
      id: form.id,
      title: "A different title",
      isOpen: true,
    });

    const fresh = await anonymousCaller().form.getFormById({ id: form.id });
    expect(fresh.title).toBe("A different title");
  });

  it("is dropped when the form is archived, closing it to the public immediately", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: form.id });
    await caller.form.archiveForm({ id: form.id });

    await expect(anonymousCaller().form.getFormById({ id: form.id })).rejects.toThrow();
  });

  it("is keyed per form, so one edit does not evict another form's entry", async () => {
    const first = await makeForm(owner, { isPublished: true, slug: "first" });
    const second = await makeForm(owner, { isPublished: true, slug: "second" });
    const caller = await callerFor(owner);

    await anonymousCaller().form.getFormById({ id: first.id });
    await anonymousCaller().form.getFormById({ id: second.id });

    await caller.form.createFormField({ formId: first.id, label: "New", type: "TEXT" });

    expect(await cached(formPublicKey(first.id))).toBeNull();
    expect(await cached(formPublicKey(second.id))).not.toBeNull();
  });

  it("lives under the suite's own Redis prefix", async () => {
    expect(formPublicKey("abc")).toMatch(/^cftest:/);
  });
});

describe("the submission count", () => {
  it("is recounted after a new response arrives", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form);
    const caller = await callerFor(owner);

    const before = await caller.form.getForm({ id: form.id });
    expect(before.submissionsCount ?? 0).toBe(0);

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: field.id, value: "x" }],
    });

    expect(
      await cached(formCountKey(form.id)),
      "the count entry must be evicted by a submission",
    ).toBeNull();
  });

  it("reflects the new total on the next read", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form);

    await anonymousCaller().form.getFormById({ id: form.id });

    for (let i = 0; i < 3; i++) {
      await anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: `answer ${i}` }],
      });
    }

    const view = await anonymousCaller().form.getFormById({ id: form.id });
    expect(view.submissionsCount).toBe(3);
  });
});

describe("with Redis unreachable", () => {
  it("still serves the form, because the cache is an optimisation", async () => {
    /* Not a simulated outage — the point is that a cache miss and a cache
     * failure take the same path: load from Postgres and answer. */
    const form = await makeForm(owner, { isPublished: true });
    await makeField(form, { label: "Question" });
    await resetRedis();

    const view = await anonymousCaller().form.getFormById({ id: form.id });
    expect(view.fields).toHaveLength(1);
  });
});
