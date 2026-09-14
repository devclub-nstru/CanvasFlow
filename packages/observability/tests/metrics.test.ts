import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { register } from "../registry";
import {
  recordFormSubmission,
  recordMailSend,
  recordQueueDepth,
  recordQueueJob,
  recordRateLimitRejection,
  recordSignup,
} from "../metrics";

/* The contract these tests defend is not "the numbers go up" — it is that
 * instrumentation can never become the reason a request fails, and that the
 * kill switch actually kills. */

async function value(name: string, labels: Record<string, string>): Promise<number | undefined> {
  const metric = await register.getSingleMetric(name)?.get();
  return metric?.values.find((v: { labels: Record<string, unknown>; value: number }) =>
    Object.entries(labels).every(([k, expected]) => v.labels[k] === expected),
  )?.value;
}

beforeEach(() => {
  register.resetMetrics();
  delete process.env.METRICS_ENABLED;
});

afterEach(() => {
  delete process.env.METRICS_ENABLED;
});

describe("recording", () => {
  it("counts sign-up stages separately", async () => {
    recordSignup("started");
    recordSignup("started");
    recordSignup("verified");

    expect(await value("canvasflow_signups_total", { stage: "started" })).toBe(2);
    expect(await value("canvasflow_signups_total", { stage: "verified" })).toBe(1);
  });

  it("counts submissions by result and reason", async () => {
    recordFormSubmission("accepted", "ok");
    recordFormSubmission("rejected", "closed");

    expect(await value("canvasflow_form_submissions_total", { result: "accepted" })).toBe(1);
    expect(await value("canvasflow_form_submissions_total", { reason: "closed" })).toBe(1);
  });

  /* The three outcomes are not interchangeable: `logged` means no relay is
   * configured and nobody received the message, which reads as success
   * everywhere else in the system. */
  it("distinguishes sent, failed and logged mail", async () => {
    recordMailSend("signup_code", "sent");
    recordMailSend("signup_code", "failed");
    recordMailSend("password_reset", "logged");

    expect(await value("canvasflow_mail_total", { template: "signup_code", result: "sent" })).toBe(
      1,
    );
    expect(
      await value("canvasflow_mail_total", { template: "signup_code", result: "failed" }),
    ).toBe(1);
    expect(
      await value("canvasflow_mail_total", { template: "password_reset", result: "logged" }),
    ).toBe(1);
  });

  it("labels an untemplated message rather than leaving the label empty", async () => {
    recordMailSend("", "sent");
    expect(await value("canvasflow_mail_total", { template: "unknown" })).toBe(1);
  });

  it("counts rate-limit rejections per bucket", async () => {
    recordRateLimitRejection("auth-login-ip");
    recordRateLimitRejection("auth-login-ip");
    recordRateLimitRejection("public-write");

    expect(await value("canvasflow_rate_limit_rejections_total", { bucket: "auth-login-ip" })).toBe(
      2,
    );
    expect(await value("canvasflow_rate_limit_rejections_total", { bucket: "public-write" })).toBe(
      1,
    );
  });

  it("counts queue jobs by outcome", async () => {
    recordQueueJob("uploads", "completed");
    recordQueueJob("uploads", "failed");

    expect(await value("canvasflow_queue_jobs_total", { result: "failed" })).toBe(1);
  });

  /* Depth is a gauge: the point is that it tracks the current level rather
   * than accumulating, so a queue that drains must show zero. */
  it("sets queue depth rather than accumulating it", async () => {
    recordQueueDepth("uploads", { waiting: 12, active: 3 });
    expect(await value("canvasflow_queue_depth", { queue: "uploads", state: "waiting" })).toBe(12);

    recordQueueDepth("uploads", { waiting: 0, active: 0 });
    expect(await value("canvasflow_queue_depth", { queue: "uploads", state: "waiting" })).toBe(0);
  });

  it("ignores non-numeric depth values instead of writing NaN", async () => {
    recordQueueDepth("uploads", { waiting: 5, broken: Number.NaN });

    expect(await value("canvasflow_queue_depth", { state: "waiting" })).toBe(5);
    expect(await value("canvasflow_queue_depth", { state: "broken" })).toBeUndefined();
  });
});

describe("the kill switch", () => {
  it("records nothing when METRICS_ENABLED is false", async () => {
    process.env.METRICS_ENABLED = "false";

    recordSignup("started");
    recordFormSubmission("accepted", "ok");

    expect(await value("canvasflow_signups_total", { stage: "started" })).toBeUndefined();
  });

  it("is on by default", async () => {
    recordSignup("started");
    expect(await value("canvasflow_signups_total", { stage: "started" })).toBe(1);
  });
});

/* If an increment can throw, monitoring has become an availability risk. */
describe("failure containment", () => {
  it("swallows an invalid label instead of throwing into the caller", () => {
    expect(() =>
      // @ts-expect-error deliberately wrong: a stage outside the closed set
      recordSignup(Symbol("not a label")),
    ).not.toThrow();
  });
});
