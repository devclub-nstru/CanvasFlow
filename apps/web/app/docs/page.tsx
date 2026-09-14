import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import { JsonLd } from "~/components/seo/JsonLd";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { absoluteUrl } from "~/lib/seo";
import { breadcrumbSchema, techArticleSchema } from "~/lib/structured-data";
import { HorizontalScale, VerticalScale } from "~/components/Scale";
import { DocsSectionNav } from "~/components/docs/DocsSectionNav";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "The complete CanvasFlow guide: building a form on the canvas, segments and branching, publishing and access control, reading the responses, and running a live Menti presentation.",
  alternates: { canonical: absoluteUrl("/docs") },
  openGraph: {
    type: "website",
    title: "Docs",
    url: absoluteUrl("/docs"),
  },
};

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: "getting-started", title: "Getting started" },
  { id: "dashboard", title: "The dashboard" },
  { id: "create", title: "Creating a form" },
  { id: "builder", title: "The builder" },
  { id: "field-types", title: "Field types" },
  { id: "field-settings", title: "Field settings" },
  { id: "segments", title: "Segments & pages" },
  { id: "branching", title: "Branching" },
  { id: "layout", title: "Layout" },
  { id: "publishing", title: "Publishing" },
  { id: "sharing", title: "Sharing a form" },
  { id: "access", title: "Who can respond" },
  { id: "availability", title: "Availability" },
  { id: "collaborators", title: "Collaborators & roles" },
  { id: "respondents", title: "What respondents see" },
  { id: "closed-states", title: "When a form won't accept" },
  { id: "responses", title: "Responses & export" },
  { id: "managing", title: "Managing your forms" },
  { id: "menti", title: "Menti — live sessions" },
  { id: "feedback", title: "Feedback & support" },
];

/** The thirteen types the palette offers, grouped as the sidebar groups them. */
const FIELD_GROUPS: { group: string; fields: [string, string][] }[] = [
  {
    group: "Text",
    fields: [
      ["Short text", "Single line input."],
      ["Long text", "Multi-line input for paragraph answers."],
      ["Email", "Email address input, format-checked before the respondent can move on."],
      ["Phone", "Telephone number input."],
      ["URL", "Website link input, parsed as a real URL before it is accepted."],
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
  {
    group: "Files",
    fields: [
      [
        "File upload",
        "An attachment. You choose how many files, how large each may be, and which types you accept.",
      ],
    ],
  },
];

/** Per-type settings in the inspector, beyond the four every field has. */
const TYPE_SETTINGS: [string, string][] = [
  ["Single select · Checkbox", "An Options list — add and remove choices as needed."],
  ["Rating", "Max stars — 3 (small), 5 (standard), or 10 (detailed)."],
  ["Toggle", "Active label and Inactive label, so the switch reads in your own words."],
  ["Date", "Min date and Max date, bounding what the calendar will accept."],
  ["Time", "Min time and Max time."],
  [
    "File upload",
    "Files per response, Max size per file, and Accepted types — any type, PDF, images, ZIP archives, Word documents, or Excel spreadsheets.",
  ],
];

/** Where a branch can send someone. */
const LOGIC_ACTIONS: [string, string][] = [
  ["Go to question", "Jump straight to a specific question, skipping whatever sits between."],
  ["Go to segment", "Jump to the start of a segment."],
  ["Finish the form", "End here and submit — useful when later questions no longer apply."],
  ["Continue in order", "Carry on to the next question, as if no branch had fired."],
];

/** The four question layouts. */
const LAYOUTS: [string, string][] = [
  [
    "Match the form's shape",
    "The default. One question at a time until you add a second segment, then one segment per page.",
  ],
  ["One question per page", "Focused and conversational. Best for longer forms and for phones."],
  ["One segment per page", "Each segment's questions together, with Next between them."],
  ["Everything on one page", "The whole form in a single scroll, like a classic web form."],
];

/** Access controls under Who can respond. */
const ACCESS_CONTROLS: [string, string][] = [
  [
    "Require sign-in",
    "Respondents sign in to a CanvasFlow account before answering. Off by default — anyone with the link can reply anonymously.",
  ],
  [
    "Record respondent email",
    "Saves each respondent's account email alongside their response. Turns on sign-in.",
  ],
  [
    "One response per person",
    "Caps each signed-in account at a single response. Off by default, so people can answer more than once. Turns on sign-in.",
  ],
  [
    "Restrict to an organisation",
    "Only accounts on the email domains you list can answer — add them one at a time. Turns on sign-in.",
  ],
];

/** The eight states a respondent can hit instead of the form. */
const LOCKOUTS: [string, string][] = [
  ["Not found", "The link doesn't match a form, or the form was deleted."],
  ["Not live", "This form is still a draft — the author hasn't published it yet."],
  ["Closed", "The author has closed it to new submissions."],
  ["Expired", "The form passed its closing date."],
  ["Already submitted", "This visitor has answered once already."],
  ["Sign in", "The author asked for responses from signed-in accounts."],
  ["Wrong account", "The signed-in email isn't on a domain the author accepts."],
  ["Archived", "The form has been archived and is no longer in service."],
];

const RESPONSE_TABS: [string, string][] = [
  [
    "Summary",
    "Total responses, completion rate, and the average time people spent filling the form in.",
  ],
  ["Question", "Every answer to one question at a time, so you can read a prompt end to end."],
  ["Individual", "One submission at a time, in full, with its own values and metadata."],
];

/** Menti slide types, grouped as the Add slide picker groups them. */
const SLIDE_TYPES: { group: string; slides: [string, string][] }[] = [
  {
    group: "Interactive questions",
    slides: [
      ["Multiple Choice", "A poll that fills in as a bar graph while people answer."],
      ["Word Cloud", "Free text from the audience, sized by how often each word comes back."],
      ["Scales", "Rating statements on a scale, averaged across the room."],
    ],
  },
  {
    group: "Quiz competitions",
    slides: [
      [
        "Select Answer",
        "A quiz question with a correct answer and a reveal. Adding one also adds a Leaderboard slide straight after it.",
      ],
    ],
  },
  {
    group: "Content slides",
    slides: [
      ["Text", "A plain slide for a heading, an instruction, or a pause between questions."],
    ],
  },
  {
    group: "Import slides",
    slides: [["PowerPoint (.pptx)", "Bring an existing deck in and carry on editing it here."]],
  },
];

const FEEDBACK_TYPES: [string, string][] = [
  ["Feedback", "Share product thoughts."],
  ["Bug report", "Something is broken."],
  ["Feature request", "Request an improvement."],
  ["Complaint", "Escalate an issue."],
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
      <div
        className="hex-mono mb-3 text-[11px] font-bold tracking-[0.18em]"
        style={{ color: "var(--hex-ink-muted)" }}
      >
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
            From signing up to exporting your last response — plus segments, branching, access
            control, and the live Menti sessions. Twenty sections, in the order you&rsquo;ll meet
            them.
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
                lead="You need an account to build a form. Nobody needs one to answer it, unless you ask for it."
              >
                <Steps
                  items={[
                    <>
                      Open{" "}
                      <Link href="/signUp" className="hex-link">
                        Sign up
                      </Link>{" "}
                      and register with your name, email, and a password — or use <UI>Google</UI> or{" "}
                      <UI>GitHub</UI> to skip the password entirely.
                    </>,
                    <>
                      You land straight on the dashboard, called <strong>Studio</strong>. It&rsquo;s
                      empty until you make something.
                    </>,
                    <>
                      Forgotten your password? <UI>Forgot password</UI> emails you a reset link that
                      works once and expires after an hour. Accounts created through Google or
                      GitHub have no password to reset — sign in with the provider instead.
                    </>,
                    <>
                      Sign out from the icon at the top right of the dashboard bar. It asks for
                      confirmation first.
                    </>,
                  ]}
                />
                <Note>
                  Passwords must be at least 12 characters, and a handful of predictable ones are
                  refused outright — a password that is one repeated character, or that is built out
                  of your own email address, won&rsquo;t be accepted. Sessions last seven days.
                </Note>
              </Chapter>

              {/* 02 */}
              <Chapter
                id="dashboard"
                n={2}
                title="The dashboard"
                lead="Three destinations in the top bar, your profile, and the button you'll use most."
              >
                <DefList
                  rows={[
                    [
                      "Studio",
                      "The overview: your forms, plus a response trend chart over 7 days, 30 days, or 3 months, with the total in range, the average per day, and your peak day.",
                    ],
                    ["Forms", "Every form you own or collaborate on."],
                    ["Menti", "Your live presentations — see Menti below."],
                    [
                      "Profile",
                      "Your identity, avatar, and session, with milestones: forms, published, responses, and this month.",
                    ],
                    ["New", "Opens the create dialog from anywhere in the dashboard."],
                  ]}
                />
                <Note>
                  Analytics aren&rsquo;t a separate destination. Every form&rsquo;s numbers live
                  inside that form, on the <UI>Responses</UI> tab of the builder — see{" "}
                  <a href="#responses" className="hex-link">
                    Responses &amp; export
                  </a>
                  .
                </Note>
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
                    [
                      "Slug",
                      "The URL-safe name, filled in from the title as you type. Lowercase words joined by hyphens, like quarterly-feedback.",
                    ],
                    ["Description", "Optional. A short note shown to respondents."],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Press <UI>Create form</UI> and you land in the builder with an empty canvas. Title
                  and slug are both required.
                </p>
                <Note>
                  There&rsquo;s a shortcut on the{" "}
                  <Link href="/" className="hex-link">
                    home page
                  </Link>
                  : type a name into the hero field and press <UI>Create form</UI>. The slug is
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
                    [
                      "Canvas",
                      "A freeform board. Drag a field from the palette onto the canvas and position it wherever you want.",
                    ],
                    [
                      "Outline",
                      "An ordered list. Click a field in the palette to append it, then move it up or down.",
                    ],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The palette sits on the left under <strong>Fields</strong>, grouped into Text,
                  Numbers, Choice, Interactive, Date &amp; time, and Files. There&rsquo;s a{" "}
                  <UI>Search fields...</UI> box if you&rsquo;d rather type than browse. Above it is
                  the <strong>Segments</strong> panel. Selecting a field opens its settings on the
                  right; with nothing selected you&rsquo;ll see <em>No field selected</em>.
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The header carries the rest: a <UI>Draft</UI> or <UI>Live</UI> status pill, an{" "}
                  <UI>Unsaved</UI> marker while you have pending edits, then <UI>Save</UI>,{" "}
                  <UI>Preview</UI>, <UI>Share</UI>, <UI>Settings</UI>, <UI>Delete</UI>, and{" "}
                  <UI>Publish</UI>. <UI>Preview</UI> opens the real public form in a new tab. Two
                  tabs sit across the top: <UI>Questions</UI> for building and <UI>Responses</UI>{" "}
                  for reading.
                </p>
                <Note>
                  Saving is explicit, not automatic. If you try to leave with unsaved changes the
                  builder stops you and asks first. If two people save the same form at once, the
                  second save is rejected as a conflict rather than quietly overwriting the first.
                  The view switcher is desktop-only — the canvas needs pointer dragging and three
                  panes, so narrow screens get the outline.
                </Note>
              </Chapter>

              {/* 05 */}
              <Chapter
                id="field-types"
                n={5}
                title="Field types"
                lead="Thirteen, in the six groups the palette uses."
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
                    [
                      "Label",
                      "The question itself. Unlabelled fields show as Untitled in the builder.",
                    ],
                    ["Placeholder", "Hint text inside the input, before anyone types."],
                    [
                      "Help text",
                      "An optional line under the question, for context or an example.",
                    ],
                    ["Required", "Forces an answer before the respondent can continue."],
                  ]}
                />
                <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.01em]">By type</h3>
                <DefList rows={TYPE_SETTINGS} />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Every field also carries a <strong>This question belongs to</strong> control,
                  which assigns it to a segment once you have any.
                </p>
                <Note>
                  Renaming a question keeps its existing answers attached. Each field is given a
                  permanent key the moment it is created, and answers are filed under that key, not
                  under the label — so you can fix wording on a live form without orphaning the
                  responses you already collected.
                </Note>
              </Chapter>

              {/* 07 */}
              <Chapter
                id="segments"
                n={7}
                title="Segments & pages"
                lead="A segment is a named group of questions. Segments are what a form's pages are made of."
              >
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  A new form is one continuous list. Press <UI>Split into segments</UI> in the
                  Segments panel to create the first one, then <UI>Add segment</UI> for each one
                  after. Segments can be renamed, reordered, and deleted from the same panel.
                </p>
                <DefList
                  rows={[
                    [
                      "Assigning a question",
                      "Pick a segment in the field's settings, under This question belongs to.",
                    ],
                    [
                      "Unassigned questions",
                      "Questions not in any segment come first, before the first segment. The panel tells you how many there are.",
                    ],
                    [
                      "Why they matter",
                      "Segments give branching somewhere to jump to, and they decide how the form is paginated.",
                    ],
                  ]}
                />
              </Chapter>

              {/* 08 */}
              <Chapter
                id="branching"
                n={8}
                title="Branching"
                lead="Send people different ways depending on what they've already answered."
              >
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Select a question and open its branching editor. A <strong>branch</strong> is one
                  or more conditions, a place to go when they hold, and optionally another place to
                  go when they don&rsquo;t. Branches are checked top to bottom after the question is
                  answered, and the first one that decides wins.
                </p>
                <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.01em]">Conditions</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  A condition reads any earlier answer, not only the one you&rsquo;re branching
                  from, and the operators on offer follow the field&rsquo;s type — <em>is</em>,{" "}
                  <em>is not</em>, <em>contains</em>, <em>does not contain</em>,{" "}
                  <em>starts with</em>, <em>ends with</em>, <em>is more than</em>,{" "}
                  <em>is less than</em>, <em>is any of</em>, <em>is none of</em>, <em>is blank</em>,
                  and <em>is answered</em>. Add several conditions to a branch to weigh more than
                  one answer at a time.
                </p>
                <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.01em]">Where it goes</h3>
                <DefList rows={LOGIC_ACTIONS} />
                <Note>
                  A branch carrying an <em>otherwise</em> always decides. One without it steps aside
                  when its conditions don&rsquo;t hold, and the next branch gets a turn. If no
                  branch decides, the next question follows in order. The editor flags rules that
                  can never fire or point nowhere under <em>Worth checking</em>.
                </Note>
              </Chapter>

              {/* 09 */}
              <Chapter
                id="layout"
                n={9}
                title="Layout"
                lead="How much of the form a respondent sees at once. Set it in Settings, under Layout."
              >
                <DefList rows={LAYOUTS} />
                <Note>
                  <strong>Everything on one page</strong> is unavailable to a form that branches or
                  is split into segments — branching needs a next page to send people to, and
                  segments are the pages. The setting is still saved; the dialog tells you what
                  respondents get instead.
                </Note>
              </Chapter>

              {/* 10 */}
              <Chapter
                id="publishing"
                n={10}
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
                      The status pill flips from <UI>Draft</UI> to <UI>Live</UI> and the button
                      reads <UI>Published</UI>.
                    </>,
                    <>The public link starts working and the form begins accepting answers.</>,
                  ]}
                />
                <Note>
                  Publishing is what makes the link live. To take it offline again, close the form
                  or give it a closing date — see{" "}
                  <a href="#availability" className="hex-link">
                    Availability
                  </a>
                  .
                </Note>
              </Chapter>

              {/* 11 */}
              <Chapter
                id="sharing"
                n={11}
                title="Sharing a form"
                lead="Press Share in the builder header, or use the share action on a form in the list."
              >
                <DefList
                  rows={[
                    [
                      "Public link",
                      "The URL to hand out. Copy public link puts it on your clipboard.",
                    ],
                    [
                      "QR code",
                      "A scannable code for the same link, downloadable as an image for print or slides.",
                    ],
                  ]}
                />
                <Note>
                  A refresh or a double-click won&rsquo;t inflate your numbers: a repeated submit of
                  the same answers is collapsed into the one record it was meant to be.
                </Note>
              </Chapter>

              {/* 12 */}
              <Chapter
                id="access"
                n={12}
                title="Who can respond"
                lead="Four controls in Settings, under Who can respond. All off by default — a published form is open to anyone with the link."
              >
                <DefList rows={ACCESS_CONTROLS} />
                <Note>
                  The last three each imply sign-in, so switching any of them on turns{" "}
                  <UI>Require sign-in</UI> on and holds it there until they&rsquo;re all off again.
                  You can also set a <strong>Thank-you note</strong> here — it&rsquo;s shown below
                  the standard confirmation, not instead of it.
                </Note>
              </Chapter>

              {/* 13 */}
              <Chapter
                id="availability"
                n={13}
                title="Availability"
                lead="Two independent controls in Settings, under Availability. Owners only."
              >
                <DefList
                  rows={[
                    [
                      "Accepting submissions",
                      "Open or closed. Manually open or close the form at any time.",
                    ],
                    [
                      "Expiration date",
                      "A date and time after which the form stops accepting answers.",
                    ],
                  ]}
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  The same dialog edits the form&rsquo;s title, description, layout, and thank-you
                  note. Press <UI>Save settings</UI> to apply.
                </p>
                <Note>
                  These stack. Whichever condition trips first closes the form, and each one shows
                  the respondent a different message — see{" "}
                  <a href="#closed-states" className="hex-link">
                    When a form won&rsquo;t accept
                  </a>
                  .
                </Note>
              </Chapter>

              {/* 14 */}
              <Chapter
                id="collaborators"
                n={14}
                title="Collaborators & roles"
                lead="Invite people to a form from the Share dialog, under Access."
              >
                <DefList
                  rows={[
                    [
                      "Owner",
                      "Full control, including settings, deletion, and transferring ownership.",
                    ],
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
                  permission for it. Roles are checked on the server for every request, so a
                  collaborator can&rsquo;t reach past their role by editing a URL. Transferring
                  ownership is not reversible by you afterwards.
                </Note>
              </Chapter>

              {/* 15 */}
              <Chapter
                id="respondents"
                n={15}
                title="What respondents see"
                lead="However much of the form your layout shows them, and nothing to sign up for unless you asked."
              >
                <DefList
                  rows={[
                    [
                      "The questions",
                      "One at a time, one segment at a time, or the whole form — whichever layout you chose.",
                    ],
                    ["A progress bar", "How far through they are, filling to complete on submit."],
                    [
                      "Inline validation",
                      "Email and URL fields are checked before the next step — an invalid address is caught rather than collected.",
                    ],
                    [
                      "Required answers",
                      "Marked as required, and enforced before they can continue.",
                    ],
                    [
                      "File uploads",
                      "A file starts uploading the moment it's picked and never blocks the submit — the form shows its progress and attaches it when they send.",
                    ],
                    ["Next and Submit", "Next advances; Submit sends on the last page."],
                    [
                      "A confirmation",
                      "Response received, followed by your thank-you note if you wrote one, and an optional How was the experience? rating.",
                    ],
                  ]}
                />
                <Note>
                  If the form requires sign-in, a signed-in respondent&rsquo;s answers and page
                  position are saved as they go, so a half-finished form survives a closed tab —
                  they pick up where they left off. A form with no fields shows{" "}
                  <em>Nothing to fill out yet</em> rather than an empty screen, so a half-built
                  draft is obvious if you share it early.
                </Note>
              </Chapter>

              {/* 16 */}
              <Chapter
                id="closed-states"
                n={16}
                title="When a form won't accept"
                lead="Eight states, each with its own message, so a respondent always knows why."
              >
                <DefList rows={LOCKOUTS} />
                <Note>
                  <UI>Wrong account</UI> lists the domains the form does accept, so someone signed
                  in with the wrong address knows which one to use.
                </Note>
              </Chapter>

              {/* 17 */}
              <Chapter
                id="responses"
                n={17}
                title="Responses & export"
                lead="Open a form and switch to the Responses tab. Three sub-tabs over the same submissions."
              >
                <DefList rows={RESPONSE_TABS} />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  <UI>CSV Export</UI> sits at the right of the sub-tabs and downloads the whole set,
                  named after the form. Responses load newest-first.
                </p>
                <Note>
                  Alongside the answers themselves, each submission carries what the form could
                  observe without tracking anyone: device category, the referring page and any UTM
                  values on the link, how long the form was open, and — only if you asked for it —
                  the respondent&rsquo;s account email.
                </Note>
              </Chapter>

              {/* 18 */}
              <Chapter
                id="managing"
                n={18}
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
                  Deleting a form is permanent and takes its responses, uploads, and collaborator
                  list with it. The confirmation dialog says so — read it before agreeing.
                </Note>
              </Chapter>

              {/* 19 */}
              <Chapter
                id="menti"
                n={19}
                title="Menti — live sessions"
                lead="A presentation you run in the room, with the audience answering from their phones."
              >
                <Steps
                  items={[
                    <>
                      Open <UI>Menti</UI> in the dashboard and create a presentation, or import an
                      existing <UI>.pptx</UI> deck.
                    </>,
                    <>
                      Build it in the editor: a slide sidebar on the left, the slide on the canvas,
                      and its settings on the right. <UI>Add slide</UI> opens the type picker.
                    </>,
                    <>
                      Press present. The intro slide shows a join code and a QR card; the audience
                      joins at{" "}
                      <Link href="/menti/join" className="hex-link">
                        /menti/join
                      </Link>{" "}
                      and enters a name.
                    </>,
                    <>
                      Move through the slides and answers appear live. Afterwards, the results view
                      keeps every slide&rsquo;s outcome.
                    </>,
                  ]}
                />
                <h3 className="pt-2 text-[17px] font-semibold tracking-[-0.01em]">Slide types</h3>
                <div className="space-y-7">
                  {SLIDE_TYPES.map((g) => (
                    <div key={g.group}>
                      <h4
                        className="hex-mono mb-2 text-[11px] font-bold tracking-[0.15em] uppercase"
                        style={{ color: "var(--hex-ink-muted)" }}
                      >
                        {g.group}
                      </h4>
                      <DefList rows={g.slides} />
                    </div>
                  ))}
                </div>
                <Note>
                  Menti runs on its own service, separate from the rest of CanvasFlow. Where that
                  service isn&rsquo;t configured, the Menti pages won&rsquo;t load their data — and
                  forms, responses, and everything else carry on working normally.
                </Note>
              </Chapter>

              {/* 20 */}
              <Chapter
                id="feedback"
                n={20}
                title="Feedback & support"
                lead="There's a feedback button inside the app. It reaches us directly."
              >
                <DefList rows={FEEDBACK_TYPES} />
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                  Pick a type, give it a subject and a message, and send. The page you were on and
                  your browser details go with it — which is usually what makes a bug reproducible.
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

      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
        ])}
      />
      <JsonLd
        data={techArticleSchema({
          headline: "CanvasFlow documentation",
          description:
            "A complete reference for building, publishing, and reading a CanvasFlow form.",
          path: "/docs",
        })}
      />
      <Footer />
    </div>
  );
}
