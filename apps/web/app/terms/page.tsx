import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "Terms of Service · CanvasFlow",
  description:
    "The agreement for using CanvasFlow: what you may build, who owns your content, and what you owe the people who answer your forms.",
};

const CONTACT_EMAIL: string | null = null;
const LEGAL_ENTITY: string | null = null;
const LAST_UPDATED = "31 July 2026";

const SUMMARY = [
  "Your forms and responses are yours. We host them, we don't claim them, and we don't use them to advertise.",
  "You're responsible for what you ask people and what you do with their answers.",
  "Don't use CanvasFlow to phish, impersonate, or collect data you have no right to collect.",
  "The service is free to use, with no cap on how many forms you build or responses you collect.",
];

const ACCOUNT_TERMS = [
  {
    what: "Accurate details",
    detail:
      "Sign up with an email address you control. We use it to verify your account and to reach you about it.",
  },
  {
    what: "Your credentials",
    detail:
      "Keep them to yourself. Activity under your account is treated as yours, so tell us promptly if you think someone else has access.",
  },
  {
    what: "One human per account",
    detail:
      "Accounts are for people, not shared logins. If you need several people on the same forms, add them as collaborators instead — that's what the roles are for.",
  },
  {
    what: "Age",
    detail:
      "You need to be old enough to enter a contract where you live. CanvasFlow isn't built for children.",
  },
];

/** The abuse vectors that actually matter for a form builder. */
const PROHIBITED = [
  "Phishing, credential harvesting, or any form dressed up as another organisation's to extract passwords, card numbers, or one-time codes.",
  "Impersonating a person, company, or public body — including in a form's title, description, or questions.",
  "Collecting personal data you have no lawful basis to collect, or using answers for something you never disclosed to the people who gave them.",
  "Distributing malware, or using a form as a staging point for an attack on someone else's systems.",
  "Unsolicited bulk messaging that drives traffic to your forms.",
  "Harassment, threats, or content that sexualises minors. Reports of the last one are escalated immediately and are not subject to the usual notice period.",
  "Probing, load-testing, or circumventing the service's limits, rate limits, or access controls without our written permission.",
  "Reselling CanvasFlow as your own product, or scraping it to build a substitute.",
];

const RESPONDENT_DUTIES = [
  {
    what: "You decide what to ask",
    detail:
      "We don't review your questions before they go out, and we don't vet what you do with the answers. That makes the questions your responsibility, not ours.",
  },
  {
    what: "Tell people why",
    detail:
      "If you collect personal data, the people answering should be able to tell who you are and what the data is for. Depending on where they live, that isn't just courtesy — it's a legal requirement you carry, not us.",
  },
  {
    what: "Be careful what you ask for",
    detail:
      "CanvasFlow is a general-purpose form product. It isn't certified for regulated categories — health records, payment card numbers, government identifiers — and you shouldn't collect those through it unless you've satisfied yourself, in writing, that your obligations are met.",
  },
  {
    what: "Honour requests",
    detail:
      "If someone asks you to correct or delete the answers they gave you, that's yours to action. You can edit or delete responses yourself, and export the full set to CSV at any time.",
  },
];

const CONTENT_TERMS = [
  {
    what: "You keep ownership",
    detail:
      "Your forms, your questions, and the responses you collect remain yours. We claim no ownership of any of it.",
  },
  {
    what: "What you grant us",
    detail:
      "Only the permission needed to run the service: to store your content, and to display it to the people you share a form with and the collaborators you add. Nothing broader, and it ends when you delete the content.",
  },
  {
    what: "What we own",
    detail:
      "CanvasFlow itself — the software, the interface, the name — stays ours. Using the product doesn't transfer any of it to you.",
  },
  {
    what: "Feedback",
    detail:
      "If you send us an idea or a bug report, we may act on it without owing you anything for it. We won't publish your report or attribute it to you without asking.",
  },
];

const COLLAB_TERMS = [
  {
    what: "Viewer",
    detail: "Can read a form and its responses. Cannot change the form or delete anything.",
  },
  {
    what: "Editor",
    detail: "Can change the form and its questions, on top of everything a viewer can do.",
  },
  {
    what: "Owner",
    detail:
      "The account that created the form. Only the owner can delete it, manage collaborators, or hand ownership to someone else.",
  },
  {
    what: "Handing over ownership",
    detail:
      "Transferring a form moves it — and its responses, and the responsibility for them — to the new owner. It also counts against their monthly limit from that point on, not yours. Transfer deliberately, because you may not be able to undo it yourself.",
  },
];

const SERVICE_TERMS = [
  {
    what: "Availability",
    detail:
      "We aim to keep CanvasFlow up and we don't currently offer a contractual uptime guarantee. Maintenance, outages, and dependency failures happen.",
  },
  {
    what: "Changes",
    detail:
      "Features change. We may add, alter, or retire them. If we remove something you rely on, or reduce a limit, we'll give you notice and time to export your data first.",
  },
  {
    what: "Your own controls",
    detail:
      "You can close a form to new responses or give it an expiry date. Those are your controls and we enforce them as set.",
  },
  {
    what: "Suspension",
    detail:
      "We may suspend a form or an account that breaks these terms. Except where the law requires otherwise, or where the abuse is severe or ongoing, we'll tell you why and give you a chance to put it right.",
  },
  {
    what: "Ending it",
    detail:
      "You can stop using CanvasFlow and delete your account whenever you like. Deleting it removes your forms and the responses under them, so export anything you want to keep before you do.",
  },
];

export default function TermsPage() {
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
            <span className="hex-fig">TERMS</span>
          </div>

          <h1 className="max-w-3xl text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[60px] md:tracking-[-0.04em] lg:text-[68px]">
            The deal, <br className="hidden sm:block" />
            in plain terms.
          </h1>

          <p
            className="mt-7 max-w-2xl text-[16px] leading-relaxed sm:mt-8 sm:text-[18px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            These terms cover using CanvasFlow — building forms, collecting answers, and reading
            what came back. Using the product means agreeing to them. For what we store and why,
            read the{" "}
            <Link href="/privacy" className="hex-link">
              privacy policy
            </Link>
            ; the two are meant to be read together.
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
            This summary isn&rsquo;t the agreement — the sections below are. Where they differ, the
            sections win.
          </p>
        </div>
      </section>

      {/* ── Your account ───────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Your account
          </h2>

          <div className="mt-10 sm:mt-14">
            {ACCOUNT_TERMS.map((item) => (
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

      {/* ── Cost ───────────────────────────────────────────────────── */}
      <section
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What it costs
          </h2>

          <div className="mt-8 max-w-2xl space-y-5">
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              Nothing. There are no plans or tiers, no card is required, and there is no cap on how
              many forms you build or how many responses you collect. Every account gets the whole
              builder, the analytics, and unlimited respondents.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              No payment processor is integrated, so nothing in these terms authorises us to charge
              you. If that ever changes, the billing terms — price, renewal, cancellation, refunds,
              and tax — will be presented and accepted before any charge.
            </p>
          </div>
        </div>

        <HorizontalScale className="absolute bottom-0 left-0 h-6 w-full sm:h-10" />
      </section>

      {/* ── Your content ───────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Who owns what
          </h2>

          <div className="mt-10 sm:mt-14">
            {CONTENT_TERMS.map((item) => (
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

      {/* ── Acceptable use ─────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What you must not build
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            A form is a good way to ask people for things, which makes it a good way to ask for
            things you shouldn&rsquo;t. Any of the following is grounds for taking a form down.
          </p>

          <ul className="mt-10 max-w-3xl space-y-4 sm:mt-12">
            {PROHIBITED.map((line, i) => (
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
            If you come across a form on CanvasFlow doing any of this, report it through the
            feedback option in the app. We&rsquo;d rather hear about it early.
          </p>
        </div>
      </section>

      {/* ── Duties to respondents ──────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What you owe the people who answer
          </h2>

          <div className="mt-10 sm:mt-14">
            {RESPONDENT_DUTIES.map((item) => (
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

      {/* ── Collaboration ──────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Sharing a form
          </h2>
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Adding someone to a form gives them access to its responses. Add people you trust with
            that data, and remove them when they no longer need it.
          </p>

          <div className="mt-10 sm:mt-14">
            {COLLAB_TERMS.map((item) => (
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

      {/* ── The service ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            The service itself
          </h2>

          <div className="mt-10 sm:mt-14">
            {SERVICE_TERMS.map((item) => (
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

      {/* ── Disclaimers ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Limits of our responsibility
          </h2>

          <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">Provided as it is</h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                CanvasFlow is provided without warranties beyond those the law won&rsquo;t let us
                exclude. We don&rsquo;t promise it will be uninterrupted, error-free, or fit for a
                particular purpose you have in mind. Keep your own copies of anything you
                can&rsquo;t afford to lose — the CSV export exists for that.
              </p>
            </div>
            <div className="hex-card p-6 sm:p-7">
              <h3 className="mb-2 text-[17px] font-medium tracking-[-0.01em]">Liability</h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                To the extent the law allows, we aren&rsquo;t liable for indirect or consequential
                loss, lost profits, or lost data, and our total liability is limited to what you
                paid us in the twelve months before the claim. Nothing here limits liability for
                fraud, death or personal injury caused by negligence, or anything else that
                can&rsquo;t lawfully be limited.
              </p>
            </div>
          </div>

          <p
            className="mt-8 max-w-3xl text-[14.5px] leading-relaxed"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            You&rsquo;re responsible for claims that arise from your own forms — what you asked, who
            you asked, and what you did with the answers. Consumer-protection law in your country
            may give you rights these two paragraphs cannot take away, and where it does, it
            prevails.
          </p>
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
              We&rsquo;ll update these terms as the product changes and move the date at the top.
              For a change that materially affects your rights, we&rsquo;ll give you notice rather
              than let you discover it. Continuing to use CanvasFlow after a change means accepting
              it; if you&rsquo;d rather not, you can export your data and close your account.
            </p>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              {LEGAL_ENTITY
                ? `CanvasFlow is operated by ${LEGAL_ENTITY}.`
                : "For anything about these terms or your account, use the feedback option inside the app — it reaches us directly."}
            </p>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            {CONTACT_EMAIL && (
              <a href={`mailto:${CONTACT_EMAIL}`} className="hex-btn-ghost">
                {CONTACT_EMAIL} →
              </a>
            )}
            <Link href="/privacy" className="hex-link text-[14px]">
              Privacy policy
            </Link>
            <Link href="/docs" className="hex-link text-[14px]">
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
