import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "Privacy Policy · CanvasFlow",
  description:
    "What CanvasFlow stores, why, how long for, and how to get it back or have it deleted — for account holders and for people answering a form.",
};

const CONTACT_EMAIL: string | null = null;
const LEGAL_ENTITY: string | null = null;
const LAST_UPDATED = "31 July 2026";

const SUMMARY = [
  "We store what you create and what people send you. We don't sell it, and we don't use it to advertise to anyone.",
  "People answering your forms are not tracked with cookies, and we never record their IP address.",
  "You can export every response to CSV at any time, and deleting a form or an account really deletes the data underneath it.",
];

const ACCOUNT_DATA = [
  {
    what: "Identity",
    detail:
      "Your name, email address, whether that email is verified, and a profile image if your sign-in provider supplies one.",
  },
  {
    what: "Sign-in credentials",
    detail:
      "Either a password — stored hashed, never in readable form — or the tokens your OAuth provider issues, plus which provider you used.",
  },
  {
    what: "Sessions",
    detail:
      "A session token, its expiry, and the IP address and browser user-agent the session was created from. This is how we keep you signed in and how you can tell a stranger's session from your own.",
  },
  {
    what: "What you build",
    detail:
      "Your forms: titles, descriptions, questions, options, and settings such as expiry dates and submission caps.",
  },
  {
    what: "Collaborators",
    detail: "If you share a form, we record who has access, their role, and who added them.",
  },
  {
    what: "Support reports",
    detail:
      "If you send feedback or report a bug, we keep the subject and message, your email, and the page URL and browser user-agent from the moment you reported it — the last two are what make a bug reproducible.",
  },
];

/** Data held about people who fill in someone else's form. */
const RESPONDENT_DATA = [
  {
    what: "Your answers",
    detail:
      "Everything you type or select, and the time you submitted. These go to the form's owner, who decides what they are for.",
  },
  {
    what: "Partial answers",
    detail:
      "Each answer is saved as you move to the next question, so an answer you gave is kept even if you close the form and never submit it. This is what tells an owner which question people give up on.",
  },
  {
    what: "A per-form identifier",
    detail:
      "A random value your own browser stores in localStorage — not a cookie — scoped to that single form. It exists only to stop the same browser submitting twice. It cannot link you across different forms or across other websites, and it never leaves your browser except alongside your submission.",
  },
  {
    what: "Device category",
    detail: "Whether you submitted from a desktop, tablet, or phone. Not a device fingerprint.",
  },
  {
    what: "How you arrived",
    detail:
      "The referring page, and any utm_source, utm_medium or utm_campaign values present in the link you followed. This tells the owner which of their channels is working.",
  },
  {
    what: "Time taken",
    detail: "How long the form was open before you submitted it.",
  },
];

/** Deliberate absences. Each of these is a real property of the system. */
const NOT_COLLECTED = [
  "No IP address is recorded for people answering a form. IP addresses are only stored for signed-in account sessions.",
  "No cookies are set on respondents, and no third-party analytics or advertising scripts run on public form pages.",
  "No cross-form or cross-site identifier. Nothing links a person who answered one form to a person who answered another.",
  "No page-view or visitor tracking. We removed it — the only records that exist are of answers actually given.",
  "We do not sell personal data, share it with data brokers, or use responses to train models.",
];

const RETENTION = [
  {
    what: "While your account is open",
    detail:
      "Forms and their responses are kept until you delete them, because they are the product — an analytics view of a form you deleted last year isn't something we can reconstruct or would want to.",
  },
  {
    what: "When you delete a form",
    detail:
      "Its questions, every submission, every partial answer, and the collaborator list are removed with it. This cascades at the database level, so there is no orphaned copy left behind.",
  },
  {
    what: "When you delete your account",
    detail:
      "Your forms and everything underneath them are removed, along with your sessions and sign-in credentials. Support reports you sent are kept but detached from your account, so we don't lose the record of a bug while still unlinking it from you.",
  },
  {
    what: "Sessions",
    detail: "Expire on their own and are removed after expiry.",
  },
];

const RIGHTS = [
  {
    what: "Get a copy",
    detail:
      "Export any form's full response set to CSV from the analytics view, whenever you like, without asking us.",
  },
  {
    what: "Correct or delete",
    detail: "Edit or delete forms and responses directly. Deleting your account removes the rest.",
  },
  {
    what: "If you answered someone's form",
    detail:
      "The form's owner controls your answers, not us — we hold them on their behalf. Ask them first. If you can't reach them and you contact us, we will help identify the right owner, but we won't hand over or delete another person's response data without a lawful basis for doing so.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="hex-theme hex-paper relative min-h-screen">
      <Noise />

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
            <span className="hex-fig">PRIVACY</span>
          </div>

          <h1 className="max-w-3xl text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[60px] md:tracking-[-0.04em] lg:text-[68px]">
            What we keep, <br className="hidden sm:block" />
            and what we don&rsquo;t.
          </h1>

          <p
            className="mt-7 max-w-2xl text-[16px] leading-relaxed sm:mt-8 sm:text-[18px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            This describes the data CanvasFlow actually stores, written against the database itself
            rather than from a template. Two different people are covered here: someone with an
            account, and someone answering a form built by one.
          </p>

          <p
            className="hex-mono mt-8 text-[11px] font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Last updated {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* ── The short version ──────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            The short version
          </h2>

          <ul className="mt-10 max-w-2xl space-y-4 sm:mt-12">
            {SUMMARY.map((line, i) => (
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
            The detail below is the whole of it. If the summary and the detail ever disagree, the
            detail is what we do.
          </p>
        </div>
      </section>

      {/* ── Who holds what ─────────────────────────────────────────── */}
      <section
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-3xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Who is responsible for a response
          </h2>

          <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">
                The form&rsquo;s owner
              </h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                They decide what to ask, why, and what to do with the answers. For the responses
                collected through their form, they are the party responsible — the controller, in
                data-protection terms. What they ask for is their call, not ours.
              </p>
            </div>
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">CanvasFlow</h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                We store and process those responses on the owner&rsquo;s behalf, and nothing more.
                For account data — your email and your sessions — we are the responsible party
                ourselves.
              </p>
            </div>
          </div>
        </div>

        <HorizontalScale className="absolute bottom-0 left-0 h-6 w-full sm:h-10" />
      </section>

      {/* ── If you have an account ─────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            If you have an account
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            All of this exists to sign you in and keep your work. Nothing more.
          </p>

          <div className="mt-10 sm:mt-14">
            {ACCOUNT_DATA.map((item) => (
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

      {/* ── If you're answering a form ─────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            If you&rsquo;re answering a form
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            You don&rsquo;t need an account to answer a form, and we don&rsquo;t create one for you.
            Here is everything recorded when you do.
          </p>

          <div className="mt-10 sm:mt-14">
            {RESPONDENT_DATA.map((item) => (
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

          <p
            className="mt-8 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            A form&rsquo;s owner writes their own questions, so a form can ask you for anything they
            choose. What you type is between you and them — read the form before you answer it.
          </p>
        </div>
      </section>

      {/* ── What we don't do ───────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What we don&rsquo;t do
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            These aren&rsquo;t intentions. Each one is a property of how the product is built.
          </p>

          <ul className="mt-10 max-w-2xl space-y-4 sm:mt-12">
            {NOT_COLLECTED.map((line, i) => (
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
        </div>
      </section>

      {/* ── Retention ──────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            How long we keep it
          </h2>

          <div className="mt-10 sm:mt-14">
            {RETENTION.map((item) => (
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

          <p
            className="mt-8 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Encrypted backups may hold a copy for a short window after deletion, which is a
            consequence of having backups at all. They age out on their own and are not used for
            anything but recovery.
          </p>
        </div>
      </section>

      {/* ── Who else sees it ───────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Who else sees it
          </h2>

          <div className="mt-10 max-w-2xl space-y-5 sm:mt-12">
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              Anyone the form&rsquo;s owner adds as a collaborator can see that form&rsquo;s
              responses, at the level their role allows. Owners can also hand ownership to someone
              else.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              Beyond that, we rely on a small number of infrastructure providers to run the service
              — application hosting, a managed database, and email delivery for things like
              verification links. They process data only to provide that infrastructure, under
              contract, and never for their own purposes.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              We will disclose data if the law genuinely requires it. If we receive such a request
              and are permitted to tell you, we will.
            </p>
          </div>
        </div>
      </section>

      {/* ── Your rights ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Getting your data back
          </h2>

          <div className="mt-10 sm:mt-14">
            {RIGHTS.map((item) => (
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

          <p
            className="mt-8 max-w-2xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Depending on where you live you may have further rights over your personal data,
            including the right to complain to a supervisory authority. Exercising any of them costs
            you nothing and we won&rsquo;t degrade your account for asking.
          </p>
        </div>
      </section>

      {/* ── Security & children ────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Security, and who this is for
          </h2>

          <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">
                How it&rsquo;s protected
              </h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                Traffic is encrypted in transit. Passwords are hashed, never stored readably. Access
                to a form&rsquo;s responses is checked on every request against ownership or an
                explicit collaborator role. No system is perfect, and we won&rsquo;t pretend
                otherwise — but if we ever discover a breach affecting your data, we will tell you
                rather than wait to be asked.
              </p>
            </div>
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">Children</h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                CanvasFlow isn&rsquo;t intended for children, and we don&rsquo;t knowingly create
                accounts for them. If you believe a child&rsquo;s personal data has reached us
                through an account or a form, tell us and we will remove it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Changes & contact ──────────────────────────────────────── */}
      <section className="relative py-20 sm:py-24">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Changes, and reaching us
          </h2>

          <div className="mt-8 max-w-2xl space-y-5">
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              When we change what we collect, we update this page and move the date at the top. For
              a change that materially affects your data, we&rsquo;ll do more than move a date —
              we&rsquo;ll tell you.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              {LEGAL_ENTITY
                ? `CanvasFlow is operated by ${LEGAL_ENTITY}.`
                : "For anything about your data — a question, a correction, or a deletion request — use the feedback option inside the app, which reaches us directly."}
            </p>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            {CONTACT_EMAIL && (
              <a href={`mailto:${CONTACT_EMAIL}`} className="hex-btn-ghost">
                {CONTACT_EMAIL} →
              </a>
            )}
            <Link href="/docs" className="hex-link text-[14px]">
              Read the docs
            </Link>
            <Link href="/about" className="hex-link text-[14px]">
              About CanvasFlow
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
