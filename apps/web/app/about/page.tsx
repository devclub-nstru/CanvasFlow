import type { Metadata } from "next";
import Link from "next/link";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "About · CanvasFlow",
  description:
    "Why CanvasFlow exists: a structured way to build forms, collect answers, and read what came back.",
};

const CONTACT_EMAIL: string | null = null;

const PRINCIPLES = [
  {
    title: "Clarity over clutter",
    desc: "Every field, step, and screen is deliberate. Nothing on the canvas is there for decoration.",
  },
  {
    title: "Answers, not just submissions",
    desc: "A form that collects replies but tells you nothing has done half its job. Reading the results is part of the product, not an add-on.",
  },
  {
    title: "Ownership by default",
    desc: "Your responses stay yours. Export the full set to CSV whenever you want, without asking.",
  },
];

const SYSTEM = [
  {
    step: "Build",
    desc: "Twelve field types on a canvas or an ordered outline. Set what's required, cap the choices, reorder as you think.",
  },
  {
    step: "Collect",
    desc: "One question at a time, with a progress bar and inline validation. Share by link or QR.",
  },
  {
    step: "Read",
    desc: "Views, responses, completion rate, and the question people gave up on — live, the moment answers land.",
  },
  {
    step: "Act",
    desc: "Close a form, set an expiry, cap submissions, or take the whole response set to CSV.",
  },
];

const AUDIENCES = [
  { who: "Product teams", what: "User research and feedback loops." },
  { who: "Marketing", what: "Lead capture and qualification." },
  { who: "Customer success", what: "Satisfaction ratings and follow-ups." },
];

const DIFFERENCES = [
  "A builder you can read: freeform canvas or ordered outline, same form either way.",
  "Analytics in the product, not bolted on behind an export.",
  "Access you control — close it, expire it, or cap it.",
  "Collaboration with real roles, including handing over ownership.",
];

export default function AboutPage() {
  return (
    <div className="hex-theme hex-paper relative min-h-screen">
      {/* Same animated grain as every other surface — one texture, tuned in
          the component rather than per page. */}
      <Noise />

      {/* Ruled page margins. Overlays rather than layout, so they only appear
          from md up where there is a gutter for them to sit in; below that
          they would land on top of the copy. */}
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
            <span className="hex-fig">ABOUT</span>
          </div>

          {/* Four type steps for the same reason the landing headline has
              them: 72px only fits from roughly 640px up. */}
          <h1 className="max-w-3xl text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[60px] md:tracking-[-0.04em] lg:text-[68px]">
            Built for teams <br className="hidden sm:block" />
            who think in systems.
          </h1>

          <p
            className="mt-7 max-w-2xl text-[16px] leading-relaxed sm:mt-8 sm:text-[18px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            CanvasFlow isn&rsquo;t just a form builder. It&rsquo;s a structured way to collect,
            understand, and act on what people tell you — without noise, without friction.
          </p>
        </div>
      </section>

      {/* ── Principles ─────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Core principles
          </h2>

          <div className="mt-12 grid gap-10 sm:mt-16 sm:gap-12 md:grid-cols-3">
            {PRINCIPLES.map((item, i) => (
              <div key={item.title}>
                <div
                  className="hex-mono mb-3 text-[11px] font-semibold tracking-[0.15em] uppercase"
                  style={{ color: "var(--hex-ink-muted)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mb-2 text-[19px] font-medium tracking-[-0.01em]">{item.title}</h3>
                <p
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The system ─────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            The system
          </h2>

          <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2">
            {SYSTEM.map((item, i) => (
              <div key={item.step} className="hex-card p-6 sm:p-7">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="hex-mono flex size-7 shrink-0 items-center justify-center border text-[11px] font-bold"
                    style={{
                      borderColor: "var(--hex-line-strong)",
                      color: "var(--hex-ink)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-[17px] font-medium tracking-[-0.01em]">{item.step}</h3>
                </div>
                <p
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Statement ──────────────────────────────────────────────── */}
      <section
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-20 sm:py-24 lg:py-32"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-4xl">
            <h2 className="text-[30px] leading-[1.07] font-semibold tracking-[-0.03em] sm:text-[38px] sm:tracking-[-0.035em] lg:text-[48px]">
              From a question{" "}
              <em
                className="font-normal italic"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                to an answer you can read.
              </em>
            </h2>
            <p
              className="mt-6 max-w-xl text-[16px] leading-relaxed sm:text-[17px]"
              style={{ color: "var(--hex-ink-soft)" }}
            >
              Publish a form and it starts reporting on itself. Completion rate, where people
              dropped off, and every response in a table you can export — no spreadsheets to stitch
              together first.
            </p>
            <Link href="/dashboard/analytics" className="hex-btn-ghost mt-7 sm:mt-8">
              Explore analytics →
            </Link>
          </div>
        </div>

        <HorizontalScale className="absolute bottom-0 left-0 h-6 w-full sm:h-10" />
      </section>

      {/* ── Where it fits ──────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Where it fits
          </h2>

          <div className="mt-10 sm:mt-14">
            {AUDIENCES.map((item) => (
              <div
                key={item.who}
                className="flex flex-col gap-1 border-b hex-line-soft py-5 sm:flex-row sm:items-baseline sm:gap-8 sm:py-6"
                style={{ borderBottomWidth: 1 }}
              >
                <div className="text-[16px] font-medium tracking-[-0.01em] sm:w-64 sm:shrink-0">
                  {item.who}
                </div>
                <div
                  className="text-[14.5px] leading-relaxed"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  {item.what}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differences ────────────────────────────────────────────── */}
      <section
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            What makes CanvasFlow different
          </h2>

          <ul className="mt-10 max-w-2xl space-y-4 sm:mt-12">
            {DIFFERENCES.map((line, i) => (
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

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="relative py-20 text-center sm:py-24">
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em] lg:text-[40px]">
            Build your first form.
          </h2>
          <p
            className="mx-auto mt-5 max-w-md text-[15.5px] leading-relaxed sm:text-[16px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            It takes a few minutes, and the analytics start the moment someone answers.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/signUp" className="hex-btn-ghost">
              Get started →
            </Link>
            <Link href="/dashboard/pricing" className="hex-link text-[14px]">
              See pricing
            </Link>
            {CONTACT_EMAIL && (
              <a href={`mailto:${CONTACT_EMAIL}`} className="hex-link text-[14px]">
                {CONTACT_EMAIL}
              </a>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
