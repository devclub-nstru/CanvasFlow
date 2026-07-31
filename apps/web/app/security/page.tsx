import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "Security · CanvasFlow",
  description:
    "How CanvasFlow protects accounts and responses: the authorisation model, rate limits, and duplicate-submission guards — plus what we haven't built yet.",
};

/* ============================================================
   GROUND RULES FOR THIS PAGE

   A security page is a trust document, so every claim below is
   one that can be pointed at a line of code:

     · Auth model            packages/trpc/server/trpc.ts
     · Session / cookies     packages/trpc/server/auth.ts
     · CORS + rate limits    apps/api/src/server.ts
     · Per-form roles        packages/services/form (require*)
     · Unique indexes        packages/database/models/form-submission.ts
     · Cascade deletes       packages/database/models/*

     · Response headers        apps/web/next.config.js (headers())

   Deliberately NOT claimed, because they are not implemented as
   of LAST_UPDATED. Do not add them to this page before they are
   true in the code:
     · An access/audit log of who read which responses.
     · Any third-party certification (SOC 2, ISO 27001) or an
       independent penetration test.
     · Encryption at rest — the managed database provider very
       likely does this, but "likely" isn't a claim worth making
       on a security page. Confirm with the provider, then say so
       specifically.
   The "Not yet" section below states these openly on purpose.

   Two-factor authentication is intentionally out of scope for
   this product and is not listed as a gap. If that changes, the
   "Accounts and sessions" section is where it belongs.

   TO FILL IN:
     · SECURITY_EMAIL — a monitored address for vulnerability
       reports. Until it is set, the disclosure section routes
       people through the in-app feedback widget, which works but
       is not the convention researchers expect.
   ============================================================ */
const SECURITY_EMAIL: string | null = null;
const LAST_UPDATED = "31 July 2026";

/** Layered authorisation. Each layer is checked independently. */
const AUTHZ_LAYERS = [
  {
    what: "The session, on every request",
    detail:
      "Every authenticated endpoint revalidates the session server-side before it runs. There is no trusted client state — a request with a stale or forged cookie is rejected at the boundary, not deeper in.",
  },
  {
    what: "The plan, read from the database",
    detail:
      "Plan-gated features re-read your tier from the database on each call rather than believing whatever the browser claims. Editing local storage to say “Business” gets you a 403, not detailed analytics.",
  },
  {
    what: "The role, per form",
    detail:
      "Before any read or write touching a specific form, we check that you own it or hold an explicit collaborator role on it. Viewer, editor, and owner are distinct, and the check runs on the request path — knowing a form's ID is not access to it.",
  },
  {
    what: "What the redirect is not",
    detail:
      "Visiting /dashboard while signed out bounces you to sign-up. That redirect only looks for a cookie's presence, so treat it as navigation convenience rather than a security control. The enforcement that matters is the three checks above, and they run whether or not the redirect did.",
  },
];

/** Session and credential handling. */
const ACCOUNT_SECURITY = [
  {
    what: "Passwords",
    detail:
      "Stored only as a hash, produced by our authentication library. We cannot read your password, and a database dump would not reveal it. If you sign in with Google or GitHub instead, we never see a password at all.",
  },
  {
    what: "Session cookies",
    detail:
      "Marked Secure, so a browser will only send them over HTTPS. They are set by the API rather than readable application state.",
  },
  {
    what: "Cross-origin requests",
    detail:
      "The API answers credentialed requests only from an explicit allowlist of origins. A request from any other site is refused before it reaches a handler, which is what stops another page from making authenticated calls with your cookie.",
  },
  {
    what: "Session records",
    detail:
      "Each session stores its own expiry, plus the IP address and browser it was created from — the detail you would need to recognise a session that isn't yours. Expired sessions stop working on their own.",
  },
  {
    what: "Browser-level protections",
    detail:
      "Every page is served with a Content-Security-Policy restricting which origins scripts, images and network calls may come from, and refusing to be embedded in a frame anywhere. Alongside it: HSTS in production so browsers refuse to downgrade to HTTP, nosniff, a referrer policy that keeps form URLs out of third-party logs, and a permissions policy denying camera, microphone, geolocation and payment access outright.",
  },
];

/** Abuse ceilings, with the real numbers. */
const LIMITS = [
  {
    what: "Public writes",
    detail:
      "Submitting a form, recording an answer, and sending a bug report are capped at 60 requests per minute per IP address. These are the endpoints reachable without an account, so they get the tightest ceiling.",
  },
  {
    what: "Signed-in requests",
    detail:
      "Capped at 300 requests per minute, counted per session rather than per IP so that several people behind one office connection don't throttle each other. IPv6 addresses are grouped by prefix so an attacker can't sidestep the count by walking through addresses.",
  },
  {
    what: "Request size",
    detail:
      "Request bodies are capped at 200 KB. A form submission is small; anything far larger is either a mistake or an attempt to exhaust memory.",
  },
  {
    what: "Monthly submission caps",
    detail:
      "Each plan has a monthly submission ceiling counted across all your forms. Beyond billing, it bounds how much traffic a single account can generate if one of its forms is targeted.",
  },
  {
    what: "Report flooding",
    detail:
      "The feedback endpoint is deliberately open, so it carries two independent guards: the per-IP limit above, and a per-reporter cap. One attacker rotating IP addresses is caught by the second; anonymous floods are caught by the first.",
  },
];

/** Correctness guards that are also integrity guards. */
const DATA_INTEGRITY = [
  {
    what: "Validated at the edge",
    detail:
      "Every endpoint declares a schema for what it accepts and what it returns, and both are validated. Input that doesn't match the shape is rejected before any handler logic runs, so malformed data can't reach the database.",
  },
  {
    what: "Parameterised queries",
    detail:
      "Database access goes through a query builder that parameterises values. Answers are never concatenated into SQL, which is what makes a form field a poor place to attempt injection.",
  },
  {
    what: "Duplicate submissions",
    detail:
      "Each submit carries an idempotency key, and forms enforce one response per visitor. Both are backed by unique constraints in the database rather than an application check alone, so two requests racing each other collapse into one row instead of both slipping through.",
  },
  {
    what: "Concurrent edits",
    detail:
      "Forms carry a version counter, compared and set on every update. If two people edit the same form at once, the second write is refused with a conflict rather than silently overwriting the first person's work.",
  },
  {
    what: "Deletion that deletes",
    detail:
      "Removal cascades at the database level: deleting a form removes its questions, submissions, and partial answers; deleting an account removes the forms beneath it. There is no detached copy left behind to leak later.",
  },
];

/** Privacy properties that are really security properties. */
const RESPONDENT_POSTURE = [
  "No IP address is recorded for people answering a form. Data we never collect cannot be exposed.",
  "No cookies are set on respondents, and no third-party analytics or advertising scripts load on public form pages.",
  "The per-form duplicate-submission identifier lives in the respondent's own browser storage and is scoped to a single form, so it cannot correlate anyone across forms or across sites.",
  "OAuth providers are only registered when both their client ID and secret are present, so a half-configured provider fails closed instead of exposing a broken sign-in path.",
];

/** Stated plainly, because a security page that lists no gaps isn't credible. */
const NOT_YET = [
  {
    what: "Strict CSP",
    detail:
      "Our Content-Security-Policy allows inline scripts, because the framework injects its startup script inline. That means the policy restricts where code can be loaded from but won't stop script injected into the page itself. Tightening it to a per-request nonce is planned.",
  },
  {
    what: "Access logging",
    detail:
      "We don't currently keep a per-form audit trail of which collaborator viewed which responses. Add collaborators deliberately, since removing someone doesn't tell you what they already read.",
  },
  {
    what: "External audit",
    detail:
      "CanvasFlow has not been independently penetration-tested and holds no compliance certification. We would rather say that than imply otherwise.",
  },
];

export default function SecurityPage() {
  return (
    <div className="hex-theme hex-paper relative min-h-screen">
      <Noise />

      {/* Ruled page margins, md and up only — below that there is no gutter
          for them to sit in and they would land on the copy. */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <VerticalScale className="absolute inset-y-0 left-0 mx-auto" />
        <VerticalScale className="absolute inset-y-0 right-0 mx-auto" />
      </div>

      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b hex-line-soft"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-hero-paper" aria-hidden />
        <div
          className="hex-corner top-4 left-4 hidden sm:block md:top-6 md:left-6"
          style={{ borderRight: 0, borderBottom: 0 }}
        />
        <div
          className="hex-corner top-4 right-4 hidden sm:block md:top-6 md:right-6"
          style={{ borderLeft: 0, borderBottom: 0 }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          <div className="mb-5 flex items-center gap-3 sm:mb-7">
            <span className="hex-fig">SECURITY</span>
          </div>

          <h1 className="max-w-3xl text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[60px] md:tracking-[-0.04em] lg:text-[68px]">
            Specifics, <br className="hidden sm:block" />
            not reassurance.
          </h1>

          <p
            className="mt-7 max-w-2xl text-[16px] leading-relaxed sm:mt-8 sm:text-[18px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Responses are often the most sensitive thing a team collects, so this page describes
            what CanvasFlow actually does to protect them — with real numbers where there are
            numbers, and a list of what we haven&rsquo;t built yet.
          </p>

          <p
            className="hex-mono mt-8 text-[11px] font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Last updated {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* ── Authorisation ──────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Who can read a response
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            The question that matters most, so it gets checked in three independent places rather
            than once at the door.
          </p>

          <div className="mt-10 sm:mt-14">
            {AUTHZ_LAYERS.map((item) => (
              <div
                key={item.what}
                className="flex flex-col gap-1 border-b hex-line-soft py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
                style={{ borderBottomWidth: 1 }}
              >
                <div className="text-[16px] font-medium tracking-[-0.01em] sm:w-64 sm:shrink-0">
                  {item.what}
                </div>
                <div
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accounts ───────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Accounts and sessions
          </h2>

          <div className="mt-10 sm:mt-14">
            {ACCOUNT_SECURITY.map((item) => (
              <div
                key={item.what}
                className="flex flex-col gap-1 border-b hex-line-soft py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
                style={{ borderBottomWidth: 1 }}
              >
                <div className="text-[16px] font-medium tracking-[-0.01em] sm:w-64 sm:shrink-0">
                  {item.what}
                </div>
                <div
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rate limits ────────────────────────────────────────────── */}
      <section
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Ceilings on abuse
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            A public form has to accept requests from strangers, so the limits are what keep that
            from becoming a liability.
          </p>

          <div className="mt-10 sm:mt-14">
            {LIMITS.map((item) => (
              <div
                key={item.what}
                className="flex flex-col gap-1 border-b hex-line-soft py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
                style={{ borderBottomWidth: 1 }}
              >
                <div className="text-[16px] font-medium tracking-[-0.01em] sm:w-64 sm:shrink-0">
                  {item.what}
                </div>
                <div
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <HorizontalScale className="absolute bottom-0 left-0 h-6 w-full sm:h-10" />
      </section>

      {/* ── Data integrity ─────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Keeping the data honest
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Most of these are correctness guarantees. They are on this page because a response set
            you can&rsquo;t trust is its own kind of failure.
          </p>

          <div className="mt-10 sm:mt-14">
            {DATA_INTEGRITY.map((item) => (
              <div
                key={item.what}
                className="flex flex-col gap-1 border-b hex-line-soft py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
                style={{ borderBottomWidth: 1 }}
              >
                <div className="text-[16px] font-medium tracking-[-0.01em] sm:w-64 sm:shrink-0">
                  {item.what}
                </div>
                <div
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Respondents ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            The strongest control is not collecting it
          </h2>

          <ul className="mt-10 max-w-3xl space-y-4 sm:mt-12">
            {RESPONDENT_POSTURE.map((line, i) => (
              <li key={line} className="flex gap-4">
                <span
                  className="hex-mono mt-1 shrink-0 text-[11px] font-semibold tracking-[0.15em]"
                  style={{ color: "var(--hex-ink-muted)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="text-[15px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {line}
                </span>
              </li>
            ))}
          </ul>

          <p
            className="mt-8 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            The full inventory of what is and isn&rsquo;t stored is in the{" "}
            <Link href="/privacy" className="hex-link">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Not yet ────────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What we haven&rsquo;t done
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            A security page listing only strengths tells you nothing, because every product has
            gaps. Here are ours, so you can decide with the real picture.
          </p>

          <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
            {NOT_YET.map((item) => (
              <div key={item.what} className="hex-card p-6 sm:p-7">
                <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">{item.what}</h3>
                <p
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <p
            className="mt-8 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            If one of these is a blocker for the data you had in mind, it&rsquo;s better to know now
            than after you&rsquo;ve collected it.
          </p>
        </div>
      </section>

      {/* ── Disclosure ─────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-24">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Found something?
          </h2>

          <div className="mt-8 max-w-2xl space-y-5">
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              We&rsquo;d genuinely rather hear it from you than find out the hard way. Report what
              you found, how to reproduce it, and what you think the impact is. We&rsquo;ll confirm
              we received it, keep you posted while we fix it, and credit you if you&rsquo;d like
              to be credited.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              Please test only against your own account and your own forms, don&rsquo;t run
              automated scans or load tests against the service, and don&rsquo;t access, alter, or
              retain anyone else&rsquo;s responses. Report it and stop there — that&rsquo;s enough
              to prove the point, and we won&rsquo;t pursue researchers who stay within those
              lines.
            </p>
            {!SECURITY_EMAIL && (
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                Use the feedback option inside the app to reach us — it routes straight to us.
                Mark it as a bug and mention it&rsquo;s security-related so we prioritise it.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            {SECURITY_EMAIL && (
              <a href={`mailto:${SECURITY_EMAIL}`} className="hex-btn-ghost">
                {SECURITY_EMAIL} →
              </a>
            )}
            <Link href="/privacy" className="hex-link text-[14px]">
              Privacy policy
            </Link>
            <Link href="/terms" className="hex-link text-[14px]">
              Terms of service
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
