import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  FileDown,
  Focus,
  LayoutTemplate,
  Lock,
  QrCode,
  Rows3,
  Users,
  type LucideIcon,
} from "lucide-react";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { ScrollReveal } from "~/components/landing/ScrollReveal";
import { HorizontalScale, HorizontalScaleDark, VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "Learn more · CanvasFlow",
  description:
    "How CanvasFlow works: twelve field types, one question at a time, live analytics, and every response exportable.",
};

const CAPABILITIES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Rows3,
    title: "Twelve field types",
    desc: "Short text, long text, email, phone, URL, number, dropdown, checkboxes, rating, toggle, date, and time. Drag to reorder, mark required, add a placeholder and a description.",
  },
  {
    icon: Focus,
    title: "One question at a time",
    desc: "Whoever fills it in sees a single question and a progress bar, so a long form stops feeling long. Email and URL fields are format-checked as people type.",
  },
  {
    icon: LayoutTemplate,
    title: "Canvas or outline",
    desc: "Lay the form out on a freeform canvas or work down an ordered list. Same form, two ways to read it — switch whenever you like.",
  },
  {
    icon: BarChart3,
    title: "Analytics that arrive with the answers",
    desc: "Views as well as responses, completion rate, the hour and day people reply, device split, and the exact question they gave up on.",
  },
  {
    icon: QrCode,
    title: "Share by link or QR",
    desc: "Publish and hand over a URL, or download a QR code. No account needed on the other end — one response per visitor, duplicate submits ignored.",
  },
  {
    icon: Lock,
    title: "You decide when it closes",
    desc: "Close the form with a toggle, give it an expiry date, or cap total submissions. Unpublish to pull the public link offline and drop back to draft.",
  },
  {
    icon: FileDown,
    title: "Your data, exportable",
    desc: "Every submission lands in a table you can page through, and the whole set downloads as CSV whenever you want it.",
  },
  {
    icon: Users,
    title: "Built with your team",
    desc: "Invite collaborators as viewers or editors, change a role later, remove someone, or transfer the form outright to a new owner.",
  },
];

const RULES = [
  "A drawn edge beats a soft panel — structure, not decoration.",
  "Square corners and hard shadows. An offset, never a blur.",
  "Monospace for figures, so numbers line up down a column.",
  "Texture belongs to the paper, not to the interface.",
  "Reduced motion is honoured, not ignored.",
];

const STEPS = [
  {
    num: "01",
    title: "Build it",
    desc: "Drop fields onto the canvas, reorder them, and mark what's required. Sane defaults mean it's publishable straight away.",
  },
  {
    num: "02",
    title: "Share it",
    desc: "Publish, then pass along the link or the QR code. Nobody needs an account to answer.",
  },
  {
    num: "03",
    title: "Collect it",
    desc: "Answers land one question at a time, validated on the way in and kept to one response per visitor.",
  },
  {
    num: "04",
    title: "Read it",
    desc: "Completion rate, drop-off per question, and the full response table — live, with CSV export when you want it elsewhere.",
  },
];

const USE_CASES = [
  {
    tag: "Research",
    title: "Surveys",
    desc: "Multi-question surveys with ratings and long-form answers, no login for respondents, and CSV out for analysis.",
  },
  {
    tag: "Marketing",
    title: "Lead capture",
    desc: "Short qualifying forms with format-checked email and URL fields, shared as a link or a QR code on print.",
  },
  {
    tag: "Product",
    title: "User feedback",
    desc: "Rating scales and open text, with drop-off per question showing you which prompt people stall on.",
  },
  {
    tag: "Events",
    title: "RSVP & registration",
    desc: "Sign-ups with a hard cap on submissions and an expiry date, so registration closes itself when it's full or done.",
  },
  {
    tag: "Hiring",
    title: "Job applications",
    desc: "Structured applications with a URL field for portfolios, reviewed by teammates you've added as viewers.",
  },
  {
    tag: "Teaching",
    title: "Course check-ins",
    desc: "Quick recurring pulse forms — toggles, ratings, a date field — read off the dashboard instead of a spreadsheet.",
  },
];

export default function LearnMorePage() {
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

        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          <ScrollReveal direction="up">
            <div className="mb-5 sm:mb-7">
              <span className="hex-fig">LEARN MORE</span>
            </div>

            <h1 className="max-w-4xl text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground sm:text-[48px] sm:tracking-[-0.035em] md:text-[64px] md:tracking-[-0.04em] lg:text-[76px]">
              Everything the form does{" "}
              <em
                className="font-normal italic"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                after you publish it.
              </em>
            </h1>
          </ScrollReveal>

          <ScrollReveal direction="left" delay={150}>
            <p
              className="mt-8 max-w-2xl border-l pl-6 text-[16px] leading-relaxed sm:text-[18px]"
              style={{
                color: "var(--hex-ink-soft)",
                borderLeftWidth: 2,
                borderLeftColor: "var(--hex-line-strong)",
              }}
            >
              CanvasFlow is a form builder with the reading half taken as seriously as the writing
              half. Twelve field types, one question at a time for whoever answers, and real numbers
              on your side the moment they do.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Rules strip ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal direction="up">
            <span className="hex-fig">THE RULES WE BUILD BY</span>
          </ScrollReveal>

          <div
            className="mt-8 border hex-line-strong bg-(--hex-surface) sm:mt-10"
            style={{ borderWidth: 1 }}
          >
            {RULES.map((line, i) => (
              <ScrollReveal key={line} direction="left" delay={i * 60}>
                <div
                  className="group flex items-baseline gap-5 border-b hex-line-soft px-5 py-5 transition-colors last:border-b-0 hover:bg-(--hex-ink) hover:text-white sm:gap-7 sm:px-8 sm:py-6"
                  style={{ borderBottomWidth: 1 }}
                >
                  <span
                    className="hex-mono shrink-0 text-[12px] font-bold tracking-[0.15em] transition-colors group-hover:text-white/60"
                    style={{ color: "var(--hex-ink-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[16px] leading-snug font-medium tracking-[-0.01em] sm:text-[20px]">
                    {line}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why / How split ────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid border hex-line-strong md:grid-cols-2" style={{ borderWidth: 1 }}>
            <div
              className="border-b hex-line-strong p-8 sm:p-12 md:border-r md:border-b-0"
              style={{ borderBottomWidth: 1, borderRightWidth: 1, background: "var(--hex-bone)" }}
            >
              <ScrollReveal direction="up">
                <span className="hex-fig">WHY WE BUILT IT</span>
                <h2 className="mt-6 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[32px]">
                  Most builders stop at{" "}
                  <em
                    className="font-normal italic"
                    style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                  >
                    collected.
                  </em>
                </h2>
                <p
                  className="mt-5 text-[15px] leading-relaxed sm:text-[16px]"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  Getting answers is the easy half. Most tools hand you a spreadsheet and call it
                  done, which leaves you stitching together the part you actually needed — how many
                  people started, where they quit, and what it all adds up to. CanvasFlow treats
                  reading the results as part of the product, not an export you deal with later.
                </p>
              </ScrollReveal>
            </div>

            <div className="p-8 sm:p-12">
              <ScrollReveal direction="up" delay={100}>
                <span className="hex-fig">HOW IT&rsquo;S BUILT</span>
                <h2 className="mt-6 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[32px]">
                  Boring where it counts.
                </h2>
                <p
                  className="mt-5 text-[15px] leading-relaxed sm:text-[16px]"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  The interesting engineering is the kind you never notice: data that survives an
                  edit, and concurrent changes that fail loudly instead of quietly.
                </p>

                <ul className="mt-7 space-y-4">
                  {[
                    ["Durable data keys", "Rename a question and its answers stay attached."],
                    [
                      "Optimistic locking",
                      "Two people editing at once get a conflict, not a silent overwrite.",
                    ],
                    [
                      "One response per visitor",
                      "A refresh or a double-click won't skew your numbers.",
                    ],
                    [
                      "Ordered by design",
                      "Fields carry a real index, so reordering never scrambles a form.",
                    ],
                  ].map(([term, gloss]) => (
                    <li key={term} className="flex gap-4">
                      <span
                        className="mt-1.75 size-2 shrink-0 rotate-45"
                        style={{ background: "var(--hex-ink)" }}
                        aria-hidden
                      />
                      <span className="text-[14.5px] leading-relaxed">
                        <span className="font-medium">{term}</span>
                        <span style={{ color: "var(--hex-ink-soft)" }}> — {gloss}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-28"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0" />

        <div className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
          <ScrollReveal direction="up">
            <div className="mb-12 flex flex-col gap-5 sm:mb-16 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="hex-fig">CAPABILITIES</span>
                <h2 className="mt-4 text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[38px] sm:tracking-[-0.035em] lg:text-[46px]">
                  Everything you need,{" "}
                  <em
                    className="font-normal italic"
                    style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                  >
                    nothing you don&rsquo;t.
                  </em>
                </h2>
              </div>
              <p
                className="hex-mono max-w-xs text-[11px] leading-relaxed tracking-[0.08em] uppercase md:text-right"
                style={{ color: "var(--hex-ink-muted)" }}
              >
                Eight systems. No fifty-tab settings panel.
              </p>
            </div>
          </ScrollReveal>

          <div
            className="grid border-t border-l hex-line-strong sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderTopWidth: 1, borderLeftWidth: 1 }}
          >
            {CAPABILITIES.map((c, i) => {
              const Icon = c.icon;
              return (
                <ScrollReveal key={c.title} direction="up" delay={(i % 4) * 60} className="h-full">
                  <div
                    className="group h-full border-r border-b hex-line-strong bg-white/60 p-6 transition-colors hover:bg-(--hex-ink) hover:text-white sm:p-7"
                    style={{ borderRightWidth: 1, borderBottomWidth: 1 }}
                  >
                    <Icon className="mb-5 size-8" strokeWidth={1.5} aria-hidden />
                    <h3 className="mb-2.5 text-[16px] font-semibold tracking-[-0.01em]">
                      {c.title}
                    </h3>
                    <p
                      className="text-[13.5px] leading-relaxed transition-colors group-hover:text-white/70"
                      style={{ color: "var(--hex-ink-soft)" }}
                    >
                      {c.desc}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        <HorizontalScale className="absolute bottom-0 left-0" />
      </section>

      {/* ── Process — inverted sheet ───────────────────────────────── */}
      {/* The reference flips to `bg-foreground text-background` here. This
          app already has a dark treatment (the comparison matrix, and the
          Dark scale variants), so the flip is in the design language. */}
      <section
        className="relative overflow-hidden py-16 sm:py-20 lg:py-28"
        style={{ background: "var(--hex-ink)", color: "#fff" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
          aria-hidden
        />
        <HorizontalScaleDark className="absolute top-0 left-0" />

        <div className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
          <ScrollReveal direction="up">
            <span className="hex-fig" style={{ color: "rgba(255,255,255,0.45)" }}>
              PROCESS
            </span>
            <h2 className="mt-4 mb-12 text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] sm:mb-16 sm:text-[38px] sm:tracking-[-0.035em] lg:text-[46px]">
              How it works.
            </h2>
          </ScrollReveal>

          <div
            className="grid border-t border-l border-white/15 sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderTopWidth: 1, borderLeftWidth: 1 }}
          >
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.num} direction="up" delay={i * 100} className="h-full">
                <div
                  className="group h-full border-r border-b border-white/15 p-7 transition-colors hover:bg-white/4 sm:p-9"
                  style={{ borderRightWidth: 1, borderBottomWidth: 1 }}
                >
                  <span className="hex-mono mb-5 block text-[52px] leading-none font-bold text-white/15 transition-colors group-hover:text-white/40 sm:text-[64px]">
                    {s.num}
                  </span>
                  <h3 className="mb-3 text-[19px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className="text-[14px] leading-relaxed text-white/60">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <HorizontalScaleDark className="absolute bottom-0 left-0" />
      </section>

      {/* ── Use cases ──────────────────────────────────────────────── */}
      <section
        className="relative border-y hex-line-soft py-16 sm:py-20 lg:py-28"
        style={{ borderTopWidth: 1, borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal direction="up">
            <span className="hex-fig">USE CASES</span>
            <h2 className="mt-4 mb-12 max-w-2xl text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] sm:mb-16 sm:text-[38px] sm:tracking-[-0.035em] lg:text-[46px]">
              Six forms you could{" "}
              <em
                className="font-normal italic"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                build this afternoon.
              </em>
            </h2>
          </ScrollReveal>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {USE_CASES.map((u, i) => (
              <ScrollReveal key={u.title} direction="up" delay={(i % 3) * 80} className="h-full">
                <div className="hex-card h-full p-6 sm:p-7">
                  <span
                    className="hex-mono mb-5 inline-block border px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] uppercase"
                    style={{ borderColor: "var(--hex-line-strong)", borderWidth: 1 }}
                  >
                    {u.tag}
                  </span>
                  <h3 className="mb-2.5 text-[18px] font-semibold tracking-[-0.01em]">{u.title}</h3>
                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--hex-ink-soft)" }}
                  >
                    {u.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 text-center sm:py-24 lg:py-32">
        <div className="hex-hero-paper" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <ScrollReveal direction="up">
            <span className="hex-fig">READY?</span>
            <h2 className="mt-5 text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[46px] sm:tracking-[-0.035em] lg:text-[58px]">
              Start with one question.
            </h2>
            <p
              className="mx-auto mt-6 max-w-lg text-[15.5px] leading-relaxed sm:text-[17px]"
              style={{ color: "var(--hex-ink-soft)" }}
            >
              Free and unlimited — as many forms and responses as you need, every field type, with
              CSV export included.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/signUp" className="hex-btn-ghost px-8 py-3.5 text-[15px]">
                Build for free →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
