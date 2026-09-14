/* Domain metrics — defined once, incremented from wherever the event happens.
 *
 * Defining these in the packages that use them would work right up until two
 * services spelled the same metric differently, at which point the dashboard
 * shows half the traffic and nobody notices. One file, imported everywhere.
 *
 * Every label value below is drawn from a closed set. Nothing here takes a
 * user id, an email, a form id or an error message.
 */

import { counter, gauge, safely } from "./registry";

/* ── Users ─────────────────────────────────────────────────────────────── */

/* Sign-up is two requests, and the gap between them is the interesting part:
 * `started` without a matching `verified` means codes are being sent and not
 * redeemed — an inbox problem, not an app problem. */
const signups = counter({
  name: "canvasflow_signups_total",
  help: "Sign-up attempts by stage. started -> a code was mailed; verified -> an account exists.",
  labelNames: ["stage"],
});

export type SignupStage = "started" | "verified" | "rejected";

export function recordSignup(stage: SignupStage): void {
  safely(() => signups.inc({ stage }));
}

/* ── Form submissions ──────────────────────────────────────────────────── */

const formSubmissions = counter({
  name: "canvasflow_form_submissions_total",
  help: "Form submissions by outcome. `reason` is a coarse class, never a message.",
  labelNames: ["result", "reason"],
});

export type SubmissionResult = "accepted" | "rejected" | "error";

/* A closed set: a TRPCError code, or "unknown". Mapping happens at the call
 * site so this signature cannot be handed a raw error string. */
export type SubmissionReason =
  | "ok"
  | "closed"
  | "validation"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "already_responded"
  | "internal"
  | "unknown";

export function recordFormSubmission(result: SubmissionResult, reason: SubmissionReason): void {
  safely(() => formSubmissions.inc({ result, reason }));
}

/* ── Mail ──────────────────────────────────────────────────────────────── */

/* The gap this closes: a dead SMTP relay currently produces no signal at all.
 * Sign-ups simply stop completing, and the first report comes from a user. */
const mailSends = counter({
  name: "canvasflow_mail_total",
  help: "Mail dispatch attempts by template and outcome.",
  labelNames: ["template", "result"],
});

export type MailResult = "sent" | "failed" | "logged";

export function recordMailSend(template: string, result: MailResult): void {
  safely(() => mailSends.inc({ template: template || "unknown", result }));
}

/* ── Rate limiting ─────────────────────────────────────────────────────── */

/* Bucket names are compile-time constants in apps/api/src/server.ts, so this
 * label is bounded by construction. A spike is either abuse or a limit set too
 * tight, and the bucket name is what tells the two apart. */
const rateLimitRejections = counter({
  name: "canvasflow_rate_limit_rejections_total",
  help: "Requests rejected with 429, by limiter bucket.",
  labelNames: ["bucket"],
});

export function recordRateLimitRejection(bucket: string): void {
  safely(() => rateLimitRejections.inc({ bucket }));
}

/* Redis being unreachable silently downgrades the limiter to per-process
 * counting, which multiplies every budget by the number of API processes. */
const rateLimitFallbacks = counter({
  name: "canvasflow_rate_limit_fallback_total",
  help: "Times a limiter fell back to per-process limits because Redis was unavailable.",
  labelNames: ["bucket"],
});

export function recordRateLimitFallback(bucket: string): void {
  safely(() => rateLimitFallbacks.inc({ bucket }));
}

/* ── Queue ─────────────────────────────────────────────────────────────── */

const queueJobs = counter({
  name: "canvasflow_queue_jobs_total",
  help: "Queue jobs finished, by queue and outcome.",
  labelNames: ["queue", "result"],
});

export type JobResult = "completed" | "failed";

export function recordQueueJob(queue: string, result: JobResult): void {
  safely(() => queueJobs.inc({ queue, result }));
}

/* Depth is a level, not an event, so it is a gauge sampled on a timer rather
 * than a counter — there is no "job became waiting" hook to increment on. */
const queueDepth = gauge({
  name: "canvasflow_queue_depth",
  help: "Jobs currently in each queue state.",
  labelNames: ["queue", "state"],
});

export function recordQueueDepth(queue: string, counts: Record<string, number>): void {
  safely(() => {
    for (const [state, value] of Object.entries(counts)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        queueDepth.set({ queue, state }, value);
      }
    }
  });
}
