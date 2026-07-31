import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";
import { DocsSectionNav } from "~/components/docs/DocsSectionNav";

export const metadata: Metadata = {
  title: "Docs · CanvasFlow",
  description:
    "A complete guide to CanvasFlow: building forms, publishing and sharing them, controlling availability, collaborating, and reading the responses.",
};

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: "getting-started", title: "Getting started" },
  { id: "dashboard", title: "The dashboard" },
  { id: "create", title: "Creating a form" },
  { id: "builder", title: "The builder" },
  { id: "field-types", title: "Field types" },
  { id: "field-settings", title: "Field settings" },
  { id: "publishing", title: "Publishing" },
  { id: "sharing", title: "Sharing a form" },
  { id: "availability", title: "Availability & limits" },
  { id: "collaborators", title: "Collaborators & roles" },
  { id: "respondents", title: "What respondents see" },
  { id: "closed-states", title: "When a form won't accept" },
  { id: "responses", title: "Responses & export" },
  { id: "analytics", title: "Analytics" },
  { id: "managing", title: "Managing your forms" },
  { id: "plans", title: "Plans" },
];

/** The twelve types the palette offers, grouped as the sidebar groups them. */
const FIELD_GROUPS: { group: string; fields: [string, string][] }[] = [
  {
    group: "Text",
    fields: [
      ["Short text", "Single line input."],
      ["Long text", "Multi-line input for paragraph answers."],
      ["Email", "Email address input, format-checked as it's typed."],
      ["Phone", "Telephone number input."],
      ["URL", "Website link input."],
    ],
  },
  { group: "Numbers", fields: [["Number", "Numeric value input."]] },
  {
    group: "Choice",
    fields: [
      ["Single select", "Dropdown menu — one answer from a list you define."],
      ["Checkbox", "Multiple checkboxes — any number of answers."],
    ],
  },
  {
    group: "Interactive",
    fields: [
      ["Rating", "Star selection, with a scale you set."],
      ["Toggle", "Yes / no switch, with your own labels for each state."],
    ],
  },
  {
    group: "Date & time",
    fields: [
      ["Date", "Calendar selection, optionally bounded by a range."],
      ["Time", "Time selection, optionally bounded by a range."],
    ],
  },
];

/** Per-type settings in the inspector, beyond the four every field has. */
const TYPE_SETTINGS: [string, string][] = [
  ["Single select · Checkbox", "An Options list — add and remove choices as needed."],
  ["Rating", "Rating scale, set with Max stars."],
  ["Toggle", "Active label, Inactive label, and Default on."],
  ["Date", "Date range, bounded by Min date and Max date."],
  ["Time", "Time range, bounded by Min time and Max time."],
];

/** The six states a respondent can hit instead of the form. */
const LOCKOUTS: [string, string][] = [
  ["Not found", "The link doesn't match a form."],
  ["Not live", "This form is still a draft — it hasn't been published yet."],
  ["Closed", "The author has closed this form to new responses."],
  ["Expired", "The form passed its expiration date."],
  ["Limit reached", "The form hit its maximum allowed number of submissions."],
  ["Already submitted", "This visitor has answered once already."],
];

const ANALYTICS_TABS: [string, string][] = [
  [
    "Summary",
    "Total views, total responses, completion rate, and average per day across the tracked window.",
  ],
  ["Responses", "The submissions table — search, open a single response, or export the set."],
  ["Drop-off", "Drop-off per question, so you can see which prompt people abandon."],
  ["Segments", "Device split across desktop, mobile, and tablet, plus where responses came from."],
];

/* ── Small building blocks ─────────────────────────────────────────── */

function Chapter({
  id,
  n,
  title,
  lead,
  children,
}: {
  id: string;
  n: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-b hex-line-soft pb-12 sm:pb-16">
      <div className="hex-mono mb-3 text-[11px] font-bold tracking-[0.18em]" style={{ color: "var(--hex-ink-muted)" }}>
        {String(n).padStart(2, "0")}
      </div>
      <h2 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[32px]">
        {title}
      </h2>
      {lead && (
        <p
          className="mt-4 max-w-2xl text-[15.5px] leading-relaxed sm:text-[16.5px]"
          style={{ color: "var(--hex-ink-soft)" }}
        >
          {lead}
        </p>
      )}
      <div className="mt-7 space-y-5">{children}</div>
    </section>
  );
}

/** A numbered walkthrough. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span
            className="hex-mono mt-0.5 flex size-6 shrink-0 items-center justify-center border text-[11px] font-bold"
            style={{ borderColor: "var(--hex-line-strong)", borderWidth: 1 }}
          >
            {i + 1}
          </span>
          <span className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Term/definition rows on hairlines — used for every reference list here. */
function DefList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="border-t hex-line-soft" style={{ borderTopWidth: 1 }}>
      {rows.map(([term, def]) => (
        <div
          key={term}
          className="flex flex-col gap-1 border-b hex-line-soft py-3.5 sm:flex-row sm:gap-6"
          style={{ borderBottomWidth: 1 }}
        >
          <dt className="text-[14.5px] font-medium sm:w-56 sm:shrink-0">{term}</dt>
          <dd className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            {def}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** An aside for the things that bite people. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border-l bg-(--hex-surface) px-5 py-4"
      style={{ borderLeftWidth: 2, borderLeftColor: "var(--hex-line-strong)" }}
    >
      <span
        className="hex-mono mb-1.5 block text-[10px] font-bold tracking-[0.18em] uppercase"
        style={{ color: "var(--hex-ink-muted)" }}
      >
        Note
      </span>
      <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
        {children}
      </p>
    </div>
  );
}

/** Inline UI label, so quoted buttons read as buttons. */
function UI({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="hex-mono border px-1.5 py-0.5 text-[12.5px] whitespace-nowrap"
      style={{ borderColor: "var(--hex-line)", borderWidth: 1, color: "var(--hex-ink)" }}
    >
      {children}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div className="hex-theme hex-paper relative min-h-screen">
      <Noise />

      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <VerticalScale className="absolute inset-y-0 left-0" />
        <VerticalScale className="absolute inset-y-0 right-0" />
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

        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20">
          <span className="hex-fig">DOCS</span>
          <h1 className="mt-5 max-w-3xl text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[58px] md:tracking-[-0.04em]">
            Every feature,{" "}
            <em
              className="font-normal italic"
              style={{ fontFamily: "var(--font-instrument-serif), serif" }}
            >
              start to finish.
            </em>
          </h1>
          <p
            className="mt-6 max-w-2xl text-[16px] leading-relaxed sm:text-[17.5px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            From signing up to exporting your last response. Sixteen sections, in the order you&rsquo;ll
            meet them.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/signUp" className="hex-btn-ghost">
              Create an account →
            </Link>
            <Link href="/learn-more" className="hex-link text-[14px]">
              What it does
            </Link>
          </div>
        </div>
      </section>

      {/* ── Index + content ────────────────────────────────────────── */}
      <section className="relative border-b hex-line-soft" style={{ borderBottomWidth: 1 }}>
        <HorizontalScale className="absolute top-0 left-0" />

        <div className="relative mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20">
          <div className="grid gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
            <DocsSectionNav sections={SECTIONS} />

            <div className="min-w-0 space-y-12 pb-16 sm:space-y-16 sm:pb-24">
              {/* 01 */}
              <Chapter
                id="getting-started"
                n={1}
                title="Getting started"
                lead="You need an account to build a form. Nobody needs one to answer it."
              >
                <Steps
                  items={[
                    <>
                      Open <Link href="/signUp" className="hex-link">Sign up</Link> and register with
                      your name, email, and a password — or use <UI>Google</UI> or <UI>GitHub</UI> to
                      skip the password.
                    </>,
                    <>
                      You land on the dashboard, called <strong>Studio</strong>. It&rsquo;s empty until
                      you make something.
                    </>,
                    <>
                      Sign out from the icon at the top right of the dashboard bar. It asks for
                      confirmation first.
                    </>,
                  ]}
                />
                <Note>
                  Respondents never sign in. Once a form is published, anyone holding the link can
                  fill it in.
                </Note>
              </Chapter>

              {/* 02 */}
              <Chapter
                id="dashboard"
                n={2}
                title="The dashboard"
                lead="Four destinations in the top bar, plus the button you'll use most."
              >
                <DefList
                  rows={[
                    ["Studio", "The overview: total forms, active forms, total responses, average per day, and your peak day, with a response trend chart over a range you pick."],
                    ["Forms", "Every form you own or collaborate on."],
                    ["Analytics", "Metrics and responses, one form at a time."],
                    ["Pricing", "Plans and limits."],
                    ["New form", "Opens the create dialog from anywhere in the dashboard."],
                  ]}
                />
              </Chapter>

              {/* 03 */}
              <Chapter
                id="create"
                n={3}
                title="Creating a form"
                lead="The create dialog is titled New canvas and asks for three things."
              >
                <DefList
                  rows={[
                    ["Title", "What the form is called, for you and for respondents."],
                    ["Slug", "The URL-safe name. Lowercase words joined by hyphens, like quarterly-feedback."],
                    ["Description", "Optional. A short note for your team."],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Press <UI>Create form</UI> and you land in the builder with an empty canvas. Title
                  and slug are both required.
                </p>
                <Note>
                  There&rsquo;s a shortcut on the <Link href="/" className="hex-link">home page</Link>:
                  type a name into the hero field and press <UI>Create form</UI>. The slug is
                  generated from what you typed.
                </Note>
              </Chapter>

              {/* 04 */}
              <Chapter
                id="builder"
                n={4}
                title="The builder"
                lead="Two surfaces over the same form. Switch whenever you like — the form doesn't change, only the way you see it."
              >
                <DefList
                  rows={[
                    ["Canvas", "A freeform board. Drag a field from the palette onto the canvas and position it wherever you want."],
                    ["Outline", "An ordered list. Click a field in the palette to append it, then move it up or down."],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The palette sits on the left under <strong>Fields</strong>, grouped into Text,
                  Numbers, Choice, Interactive, and Date &amp; time. There&rsquo;s a{" "}
                  <UI>Search fields...</UI> box if you&rsquo;d rather type than browse. Selecting a field
                  opens its settings on the right; with nothing selected you&rsquo;ll see{" "}
                  <em>No field selected</em>.
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The header carries the rest: a <UI>Draft</UI> or <UI>Live</UI> status pill, an{" "}
                  <UI>Unsaved</UI> marker while you have pending edits, then <UI>Save</UI>,{" "}
                  <UI>Preview</UI>, <UI>Share</UI>, <UI>Settings</UI>, <UI>Delete</UI>, and{" "}
                  <UI>Publish</UI>. <UI>Preview</UI> opens the real public form in a new tab.
                </p>
                <Note>
                  Saving is explicit, not automatic. If you try to leave with unsaved changes the
                  builder stops you and asks first. The view switcher is desktop-only — the canvas
                  needs pointer dragging and three panes, so narrow screens get the outline.
                </Note>
              </Chapter>

              {/* 05 */}
              <Chapter
                id="field-types"
                n={5}
                title="Field types"
                lead="Twelve, in the five groups the palette uses."
              >
                <div className="space-y-7">
                  {FIELD_GROUPS.map((g) => (
                    <div key={g.group}>
                      <h3
                        className="hex-mono mb-2 text-[11px] font-bold tracking-[0.15em] uppercase"
                        style={{ color: "var(--hex-ink-muted)" }}
                      >
                        {g.group}
                      </h3>
                      <DefList rows={g.fields} />
                    </div>
                  ))}
                </div>
              </Chapter>

              {/* 06 */}
              <Chapter
                id="field-settings"
                n={6}
                title="Field settings"
                lead="Four settings on every field, plus extras that depend on the type."
              >
                <DefList
                  rows={[
                    ["Label", "The question itself. Unlabelled fields show as Untitled in the builder."],
                    ["Help text", "An optional line under the question, for context or an example."],
                    ["Placeholder", "Hint text inside the input, before anyone types."],
                    ["Required", "Forces an answer before the respondent can continue."],
                  ]}
                />
                <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.01em]">By type</h3>
                <DefList rows={TYPE_SETTINGS} />
                <Note>
                  Renaming a question keeps its existing answers attached, so you can fix wording on
                  a live form without orphaning the responses you already collected.
                </Note>
              </Chapter>

              {/* 07 */}
              <Chapter
                id="publishing"
                n={7}
                title="Publishing"
                lead="A form is a draft until you publish it. Drafts aren't reachable by link."
              >
                <Steps
                  items={[
                    <>
                      Press <UI>Publish</UI> in the builder header. Any unsaved changes are saved
                      first.
                    </>,
                    <>
                      The status pill flips from <UI>Draft</UI> to <UI>Live</UI> and the button reads{" "}
                      <UI>Published</UI>.
                    </>,
                    <>The public link starts working and the form begins recording views.</>,
                  ]}
                />
                <Note>
                  Publishing is what makes the link live. To take it offline again, close the form or
                  set a limit — see <a href="#availability" className="hex-link">Availability &amp; limits</a>.
                </Note>
              </Chapter>

              {/* 08 */}
              <Chapter
                id="sharing"
                n={8}
                title="Sharing a form"
                lead="Press Share in the builder header, or use the share action on a form in the list."
              >
                <DefList
                  rows={[
                    ["Public link", "The URL to hand out. Copy public link puts it on your clipboard."],
                    ["QR code", "A scannable code for the same link, downloadable as an image for print or slides."],
                  ]}
                />
                <Note>
                  One response per visitor is enforced, and duplicate submits are ignored — a refresh
                  or a double-click won&rsquo;t inflate your numbers.
                </Note>
              </Chapter>

              {/* 09 */}
              <Chapter
                id="availability"
                n={9}
                title="Availability & limits"
                lead="Three independent controls in Settings, under Availability. Owners only."
              >
                <DefList
                  rows={[
                    ["Accepting submissions", "Open or Closed. Manually open or close the form at any time."],
                    ["Expiration date", "Stop accepting after a given time."],
                    ["Submission limit", "Stop accepting after a total count."],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The same dialog edits the form&rsquo;s title and description. Press{" "}
                  <UI>Save settings</UI> to apply.
                </p>
                <Note>
                  These stack. Whichever condition trips first closes the form, and each one shows the
                  respondent a different message — see{" "}
                  <a href="#closed-states" className="hex-link">When a form won&rsquo;t accept</a>.
                </Note>
              </Chapter>

              {/* 10 */}
              <Chapter
                id="collaborators"
                n={10}
                title="Collaborators & roles"
                lead="Invite people to a form from the Share dialog, under Access."
              >
                <DefList
                  rows={[
                    ["Owner", "Full control, including settings, deletion, and transferring ownership."],
                    ["Editor", "Can work on the form."],
                    ["Viewer", "Read-only access."],
                  ]}
                />
                <Steps
                  items={[
                    <>
                      Use <UI>Invite collaborator</UI> and search for a teammate by name or email.
                    </>,
                    <>Pick their role. You can change it later from the same list.</>,
                    <>
                      <UI>Remove collaborator</UI> revokes access.
                    </>,
                    <>
                      <UI>Transfer ownership</UI> hands the form to someone else outright — use it
                      when a form stops being yours to run.
                    </>,
                  ]}
                />
                <Note>
                  Only owners see <UI>Settings</UI>, and deletion is limited to whoever has the
                  permission for it. Transferring ownership is not reversible by you afterwards.
                </Note>
              </Chapter>

              {/* 11 */}
              <Chapter
                id="respondents"
                n={11}
                title="What respondents see"
                lead="One question at a time, and nothing to sign up for."
              >
                <DefList
                  rows={[
                    ["A single question", "One prompt on screen at a time, so a long form doesn't read as long."],
                    ["A progress bar", "How far through they are, filling to complete on submit."],
                    ["Inline validation", "Email and URL fields are checked as they type — an invalid address is caught before the next step."],
                    ["Required answers", "Marked as required, and enforced before they can continue."],
                    ["Next and Submit", "Next advances; Submit sends on the last question."],
                    ["A confirmation", "Response received, with an optional How was the experience? rating."],
                  ]}
                />
                <Note>
                  A form with no fields shows <em>Nothing to fill out yet</em> rather than an empty
                  screen, so a half-built draft is obvious if you share it early.
                </Note>
              </Chapter>

              {/* 12 */}
              <Chapter
                id="closed-states"
                n={12}
                title="When a form won't accept"
                lead="Six states, each with its own message, so a respondent always knows why."
              >
                <DefList rows={LOCKOUTS} />
              </Chapter>

              {/* 13 */}
              <Chapter
                id="responses"
                n={13}
                title="Responses & export"
                lead="Every submission lands in a table under the Responses tab in Analytics."
              >
                <DefList
                  rows={[
                    ["Browse", "Responses load newest-first, with Load older to page back through them."],
                    ["Search", "Search responses... filters the table."],
                    ["Inspect", "View details opens a single submission in full."],
                    ["Export", "Export downloads the whole set as a CSV named after the form."],
                  ]}
                />
                <Note>
                  Export needs at least one response — with none, it tells you there&rsquo;s nothing to
                  export rather than handing you an empty file.
                </Note>
              </Chapter>

              {/* 14 */}
              <Chapter
                id="analytics"
                n={14}
                title="Analytics"
                lead="Pick a form, then work through four tabs. Numbers start the moment the form is live."
              >
                <DefList rows={ANALYTICS_TABS} />
                <Note>
                  Views are counted as well as responses, which is what makes completion rate and
                  drop-off meaningful — you can see how many people looked and left, not just who
                  finished.
                </Note>
              </Chapter>

              {/* 15 */}
              <Chapter
                id="managing"
                n={15}
                title="Managing your forms"
                lead="The Forms page lists everything you own or collaborate on."
              >
                <DefList
                  rows={[
                    ["Filter", "All forms, Drafts, or Published."],
                    ["Search", "Search forms... by title."],
                    ["Sort", "By newest, title, last edited, response count, or status."],
                    ["Per-form actions", "Open it in the builder, share it, or delete it."],
                    ["Pages", "Previous and Next page when the list outgrows one screen."],
                  ]}
                />
                <Note>
                  Deleting a form is permanent and takes its responses with it. The confirmation
                  dialog says so — read it before agreeing.
                </Note>
              </Chapter>

              {/* 16 */}
              <Chapter
                id="plans"
                n={16}
                title="Plans"
                lead="The Free plan is ₹0 forever: ten active forms, a thousand submissions a month, every field type, and CSV export."
              >
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Paid tiers raise the form and submission ceilings, extend how long response history
                  is kept, and unlock the per-question analytics breakdowns. The{" "}
                  <Link href="/dashboard/pricing" className="hex-link">pricing page</Link> has the
                  current numbers for each tier.
                </p>
              </Chapter>

              {/* Close */}
              <div className="pt-2">
                <h2 className="text-[24px] leading-[1.12] font-semibold tracking-[-0.03em] sm:text-[28px]">
                  That&rsquo;s the whole product.
                </h2>
                <p
                  className="mt-4 max-w-xl text-[15.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  Best way to learn the builder is to open it with something small and real — a
                  three-question form you actually need answers to.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
                  <Link href="/signUp" className="hex-btn-ghost">
                    Build your first form →
                  </Link>
                  <Link href="/about" className="hex-link text-[14px]">
                    About CanvasFlow
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
