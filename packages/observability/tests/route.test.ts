import { beforeEach, describe, expect, it } from "vitest";

import { normalizeRoute, resetRouteCache, statusClass } from "../route";

/* These tests exist for one reason: an unbounded route label is how a metrics
 * stack takes down the service it was installed to watch. Every case below is
 * a path shape this API actually serves, asserted to collapse to something
 * with a fixed number of possible values. */

beforeEach(() => {
  resetRouteCache();
});

describe("normalizeRoute", () => {
  it("replaces a UUID segment", () => {
    expect(normalizeRoute("/api/forms/9f3c1e22-1111-4222-8333-444455556666")).toBe(
      "/api/forms/:id",
    );
  });

  it("replaces an id in the middle of a path", () => {
    expect(normalizeRoute("/api/forms/9f3c1e22-1111-4222-8333-444455556666/submit")).toBe(
      "/api/forms/:id/submit",
    );
  });

  it("replaces numeric and long-hex segments", () => {
    expect(normalizeRoute("/api/submissions/12345")).toBe("/api/submissions/:id");
    expect(normalizeRoute("/api/uploads/a1b2c3d4e5f60718")).toBe("/api/uploads/:id");
  });

  it("replaces opaque generated keys", () => {
    expect(normalizeRoute("/f/V1StGXR8Z5jdHi6B")).toBe("/f/:id");
  });

  /* The distinction that matters: a route name is not an id, however long. */
  it("keeps real path words", () => {
    expect(normalizeRoute("/api/auth/signup/verify")).toBe("/api/auth/signup/verify");
    expect(normalizeRoute("/api/feedback/submit")).toBe("/api/feedback/submit");
  });

  /* Regression: "long and contains a digit" also describes route words like
   * these, and collapsing them to :id would quietly merge distinct endpoints
   * into one line on every panel. */
  it("does not mistake a hyphenated route word for an id", () => {
    expect(normalizeRoute("/api/oauth2-callback")).toBe("/api/oauth2-callback");
    expect(normalizeRoute("/api/unexpected-0/shape")).toBe("/api/unexpected-0/shape");
    expect(normalizeRoute("/api/v2-forms/list")).toBe("/api/v2-forms/list");
  });

  it("uses the tRPC procedure name as the label", () => {
    expect(normalizeRoute("/trpc/form.submitForm")).toBe("/trpc/form.submitForm");
  });

  /* Every subset of procedures a client happens to batch would otherwise be
   * its own series — combinatorial, not linear. */
  it("collapses batched tRPC calls to one label", () => {
    expect(normalizeRoute("/trpc/form.getForm,form.listFields,user.me")).toBe("/trpc/:batch");
  });

  it("strips the query string", () => {
    expect(normalizeRoute("/trpc/form.getForm?input=%7B%7D&batch=1")).toBe("/trpc/form.getForm");
  });

  it("normalises trailing slashes so they are not a second series", () => {
    expect(normalizeRoute("/api/health/")).toBe(normalizeRoute("/api/health"));
    expect(normalizeRoute("/")).toBe("/");
  });

  it("is stable — the same path always yields the same label", () => {
    const once = normalizeRoute("/api/forms/9f3c1e22-1111-4222-8333-444455556666");
    const twice = normalizeRoute("/api/forms/0000aaaa-2222-4333-8444-555566667777");
    expect(once).toBe(twice);
  });

  /* The backstop. Normalisation should keep us far below the cap; this proves
   * that a path shape nobody anticipated still cannot grow series without
   * bound. */
  it("stops inventing templates past the cap", () => {
    /* Letter-only segments, so they survive normalisation and genuinely each
     * want their own template — which is exactly what the cap has to refuse. */
    const word = (n: number) =>
      `seg${String.fromCharCode(97 + (n % 26))}${"x".repeat(1 + (n % 7))}${String.fromCharCode(97 + Math.floor(n / 26))}`;

    for (let i = 0; i < 200; i += 1) normalizeRoute(`/${word(i)}/shape`);

    const labels = new Set<string>();
    for (let i = 0; i < 200; i += 1) labels.add(normalizeRoute(`/${word(i)}/shape`));

    expect(labels.has("/other")).toBe(true);
    expect(labels.size).toBeLessThanOrEqual(121);
  });

  it("bounds the depth of a very deep path", () => {
    const deep = normalizeRoute("/a/b/c/d/e/f/g/h/i/j/k/l");
    expect(deep.split("/").length - 1).toBeLessThanOrEqual(8);
  });
});

describe("statusClass", () => {
  it("buckets by leading digit", () => {
    expect(statusClass(200)).toBe("2xx");
    expect(statusClass(204)).toBe("2xx");
    expect(statusClass(302)).toBe("3xx");
    expect(statusClass(404)).toBe("4xx");
    expect(statusClass(429)).toBe("4xx");
    expect(statusClass(500)).toBe("5xx");
    expect(statusClass(503)).toBe("5xx");
  });
});
