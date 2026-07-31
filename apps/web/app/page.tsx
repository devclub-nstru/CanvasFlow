"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import Footer from "~/components/Footer";
import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { HorizontalScale, VerticalScale } from "~/components/Scale";
import {
  GeoGlyph,
  FormBuilderMock,
  ResponseFeedMock,
  CanvasEditorMock,
  AnalyticsMock,
} from "~/components/landing/CanvasFlowMockup";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useCreateForm } from "~/hooks/api/form";
import { cn } from "~/lib/utils";

/* ── Ruler strips ──────────────────────────────────────────────────── */

/* ── Copy ──────────────────────────────────────────────────────────── */

const STARTERS = ["Customer feedback", "Event registration", "Job application"];

const FIELD_TYPES = [
  "Short text",
  "Long text",
  "Email",
  "Phone",
  "URL",
  "Number",
  "Dropdown",
  "Checkboxes",
  "Rating",
  "Toggle",
  "Date",
  "Time",
];

const FAQS = [
  {
    q: "How is CanvasFlow different from Google Forms?",
    a: "Respondents answer one question at a time with a progress bar, so long forms don't feel long. On your side you get views as well as responses, completion rate, drop-off per question, and device split — not just a spreadsheet of answers.",
  },
  {
    q: "Do my respondents need an account?",
    a: "No. Once you publish a form, anyone with the link can fill it in. CanvasFlow keeps one response per visitor and ignores duplicate submits, so a refresh or a double-click won't skew your numbers.",
  },
  {
    q: "Which field types can I use?",
    a: `${FIELD_TYPES.slice(0, -1).join(", ")}, and ${FIELD_TYPES.at(-1)?.toLowerCase()}. Each field can be marked required, given a placeholder and a description, and dragged into any order. Email and URL fields are format-checked as people type.`,
  },
  {
    q: "How do I stop collecting responses?",
    a: "Close the form with one toggle, set an expiry date, or cap the total number of submissions. You can also unpublish it entirely, which puts it back into draft and takes the public link offline.",
  },
  {
    q: "Can I export my responses?",
    a: "Yes. Every submission lands in a paginated table you can read through, and you can download the whole set as CSV whenever you like.",
  },
  {
    q: "Can my team help build a form?",
    a: "Invite teammates as collaborators and give each one access per area — the builder, the analytics, the responses, or the settings. You can change someone's role later, remove them, or transfer ownership outright.",
  },
];

/** Turn a form title into a URL-safe, reasonably unique slug. */
const slugify = (value: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "form"}-${suffix}`;
};

/* ── Page ──────────────────────────────────────────────────────────── */

const Index = () => {
  const [title, setTitle] = useState("");
  const { userInfo: user } = useGetLoggedInUserInfo();
  const { createFormAsync, isPending } = useCreateForm();
  const router = useRouter();

  const handleCreate = async () => {
    if (!user) {
      router.push("/signUp");
      return;
    }
    if (!title.trim() || isPending) return;

    const formTitle = title.trim().slice(0, 150);
    const toastId = toast.loading("Creating your form...", {
      description: "Opening a fresh canvas.",
    });

    try {
      const created = await createFormAsync({ title: formTitle, slug: slugify(formTitle) });

      toast.success("Form created", {
        id: toastId,
        description: `Opening "${formTitle}" in the builder.`,
      });

      router.push(`/dashboard/sketches/${created.id}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not create the form", {
        id: toastId,
        description:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    }
  };

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
        {/* Background 1 of 3: tiled crack network, the lightest sheet. */}
        <div className="hex-hero-paper" aria-hidden />
        <div className="hex-corner top-4 left-4 hidden sm:block md:top-6 md:left-6" style={{ borderRight: 0, borderBottom: 0 }} />
        <div className="hex-corner top-4 right-4 hidden sm:block md:top-6 md:right-6" style={{ borderLeft: 0, borderBottom: 0 }} />

        <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <h1 className="text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-foreground sm:text-[46px] sm:tracking-[-0.035em] md:text-[64px] md:tracking-[-0.04em] lg:text-[68px] xl:text-[80px]">
                  Forms, <br />
                  <span className="relative">
                    thoughtfully
                    <svg
                      className="absolute -bottom-1 left-0 h-2 w-full text-accent/30 sm:-bottom-2 sm:h-3"
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <path
                        d="M0 5 Q 25 0, 50 5 T 100 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                  </span>
                  <br />
                  built for teams.
                </h1>

                <p
                  className="mt-5 max-w-120 text-[15px] leading-relaxed sm:mt-8 sm:text-[17px]"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  Twelve field types, one question at a time for whoever fills it in, and real
                  numbers on the other side. Publish with a link, close it when you&rsquo;re done.
                </p>

                <div className="group relative mt-7 max-w-135 sm:mt-9">
                  <div className="relative z-10 flex flex-col items-stretch rounded-none border hex-line-strong bg-white p-1.5 transition-shadow focus-within:shadow-[4px_4px_0_0_rgba(26,29,41,0.12)] sm:flex-row">
                    <label htmlFor="hero-title" className="sr-only">
                      Name your form
                    </label>
                    <input
                      id="hero-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Name your form..."
                      className="w-full border-none bg-transparent px-4 py-3 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none sm:flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleCreate();
                        }
                      }}
                    />
                    <button
                      onClick={() => void handleCreate()}
                      disabled={isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-none bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50 sm:w-auto"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create form"}
                    </button>
                  </div>

                  <div className="relative z-10 mt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="hex-mono mr-2 text-[10px] font-bold tracking-widest uppercase opacity-50">
                        Start with:
                      </span>
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setTitle(s)}
                          className="rounded-none border hex-line-strong bg-transparent px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-foreground hover:text-background"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <Image
                src="https://ik.imagekit.io/yatharth/image%20(10).png"
                alt="CanvasFlow form builder interface"
                width={1200}
                height={1000}
                priority
                className="pointer-events-none relative h-auto w-full rounded-2xl select-none"
              />
            </motion.div>
          </div>

          <div className="relative pt-12 sm:pt-16 lg:pt-20">
            <div className="relative grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <ResponseFeedMock />
              </div>
              {/* The wide mock takes the larger column and the upward
                  offset, so the pair reads as staggered rather than as
                  two cards on a shared baseline. */}
              <div className="lg:col-span-7 lg:-mt-12">
                <FormBuilderMock />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FIG.01 · The canvas ────────────────────────────────────── */}
      <FeatureBlock
        id="canvas"
        glyph="01"
        title={
          <>
            A canvas that <br />
            stays out of the way.
          </>
        }
        body="Sane defaults. No fifty-tab settings panels. Drop in a field, write the question, mark it required — your form is already publishable, accessible, and fast on mobile."
        cta="Open the builder"
        mock={<CanvasEditorMock />}
        reverse
      />

      {/* ── FIG.02 · Dashboards ────────────────────────────────────── */}
      <section
        id="analytics"
        className="hex-vignette relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-32"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="hex-section-paper" aria-hidden />
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-start gap-10 sm:gap-14 lg:grid-cols-[1fr_2.5fr] lg:gap-20">
            <div className="lg:sticky lg:top-32">
              <div className="mb-4 flex items-center gap-3 sm:mb-6">
                <GeoGlyph />
                <span className="hex-fig">FIG.02</span>
              </div>
              <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:leading-[1.05] sm:tracking-[-0.035em] lg:text-[40px]">
                Beautiful dashboards,{" "}
                <em
                  className="font-normal italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  for when you want to click around.
                </em>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed sm:mt-6 sm:text-[16px]" style={{ color: "var(--hex-ink-soft)" }}>
                Views and responses, completion rate, the hour and the day people actually reply,
                and which question they gave up on. Your form becomes a real dashboard the second
                answers land — no exports, no spreadsheets.
              </p>
              <Link href="/dashboard/analytics" className="hex-btn-ghost mt-6 sm:mt-7">
                Explore analytics →
              </Link>
            </div>
            <div>
              <AnalyticsMock />
            </div>
          </div>
        </div>
        <HorizontalScale className="absolute bottom-0 left-0 h-6 w-full sm:h-10" />
      </section>

      {/* ── FIG.03 · Sharing & access ──────────────────────────────── */}
      <section
        id="responses"
        className="relative overflow-hidden border-b hex-line-soft py-16 sm:py-20 lg:py-28"
        style={{ borderBottomWidth: 1 }}
      >
        {/* Background 2 of 3: the bare page stock, no overlay. */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 sm:gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
            <div className="max-w-lg">
              <div className="mb-4 flex items-center gap-3 sm:mb-6">
                <GeoGlyph />
                <span className="hex-fig">FIG.03</span>
              </div>
              <h2 className="text-[30px] leading-[1.07] font-semibold tracking-[-0.03em] sm:text-[36px] sm:leading-[1.04] sm:tracking-[-0.035em] lg:text-[44px]">
                One link. <br />
                <em
                  className="font-normal italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  You decide when it closes.
                </em>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed sm:mt-7 sm:text-[17px]" style={{ color: "var(--hex-ink-soft)" }}>
                Publish and share the link, or hand over a QR code. Close the form with a toggle,
                give it an expiry date, or cap the number of submissions. Every response is kept to
                one per visitor.
              </p>
              <Link href="/dashboard/sketches" className="hex-btn-ghost mt-7 text-[14px] sm:mt-9">
                Your forms →
              </Link>
            </div>
            <div className="min-w-0">
              <ShareAccessMock />
            </div>
          </div>
        </div>
      </section>

      {/* ── Three steps ────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="relative overflow-hidden border-y hex-line-soft py-16 sm:py-20 lg:py-32"
        style={{ borderTopWidth: 1, borderBottomWidth: 1 }}
      >
        {/* Background 2 of 3: the bare page stock, no overlay. */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl sm:mb-16 lg:mb-20">
            <h2 className="text-[30px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[38px] sm:leading-[1.05] sm:tracking-[-0.035em] lg:text-[48px]">
              Three steps.{" "}
              <em
                className="font-normal italic"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                No ceremony.
              </em>
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 md:grid-cols-3">
            <FeatureStepCard
              n="01"
              t="Build it"
              d="Drag fields onto the canvas from twelve types, reorder them, and mark what's required."
              illustration={<BuildIllustration />}
            />
            <FeatureStepCard
              n="02"
              t="Share it"
              d="Publish, then pass along the link or the QR code. Close it, expire it, or cap it."
              illustration={<ShareIllustration />}
            />
            <FeatureStepCard
              n="03"
              t="Read it"
              d="Live charts, the response table, drop-off per question, and CSV export."
              illustration={<SignalIllustration />}
            />
          </div>
        </div>
      </section>

      {/* ── Collaboration ──────────────────────────────────────────── */}
      <section
        id="collaborate"
        className="relative border-b hex-line-soft py-16 sm:py-20 lg:py-24"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
            <div>
              <div className="mb-4 flex items-center gap-3 sm:mb-6">
                <GeoGlyph />
                <span className="hex-fig">FIG.04</span>
              </div>
              <h2 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[34px] sm:leading-[1.05] sm:tracking-[-0.035em] lg:text-[40px]">
                Bring the team,{" "}
                <em
                  className="font-normal italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  not the whole company.
                </em>
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  h: "Access per area",
                  d: "Give a collaborator the builder, the analytics, the responses, or the settings — separately.",
                },
                {
                  h: "Roles you can change",
                  d: "Promote, demote, or remove someone at any time without rebuilding the form.",
                },
                {
                  h: "Hand over ownership",
                  d: "Transfer a form to someone else outright when it stops being yours to run.",
                },
                {
                  h: "Sign in your way",
                  d: "Email and password, or Google and GitHub if you'd rather skip another password.",
                },
              ].map((item) => (
                <div key={item.h} className="border-t hex-line-strong pt-5" style={{ borderTopWidth: 1 }}>
                  <h3 className="text-[15px] font-semibold">{item.h}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                    {item.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="hex-vignette relative border-b hex-line-soft py-16 sm:py-20 lg:py-28"
        style={{ borderBottomWidth: 1 }}
      >
        <HorizontalScale className="absolute top-0 left-0 h-6 w-full sm:h-10" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-[360px_1fr] lg:gap-16">
          <div>
            <h2 className="text-[29px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[35px] sm:leading-[1.05] sm:tracking-[-0.035em] lg:text-[42px]">
              Questions,{" "}
              <em
                className="font-normal italic"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                answered.
              </em>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
              The short version of what teams ask us most. Want the long one?
            </p>
            <Link href="/signUp" className="hex-link mt-5 inline-flex text-[14px]">
              Talk to the team →
            </Link>
          </div>
          <div className="border-t hex-line-soft" style={{ borderTopWidth: 1 }}>
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                className="hex-faq-row border-b hex-line-soft px-1"
                style={{ borderBottomWidth: 1 }}
              >
                <summary>
                  <span className="flex items-baseline gap-4">
                    <span className="hex-mono text-[11px] tracking-wider" style={{ color: "var(--hex-ink-muted)" }}>
                      0{i + 1}
                    </span>
                    <span className="text-[16px] leading-snug font-medium sm:text-[18px]">{f.q}</span>
                  </span>
                  <span className="hex-faq-icon">+</span>
                </summary>
                <div className="hex-faq-body" style={{ paddingLeft: "calc(11px + 1rem)" }}>
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

/* ── Sharing & access mock ─────────────────────────────────────────── */

const ShareAccessMock = () => (
  <div className="hex-card w-full overflow-hidden">
    <div
      className="flex items-center justify-between border-b hex-line-soft px-4 py-2.5"
      style={{ borderBottomWidth: 1 }}
    >
      <span className="text-[12px] font-medium">Share · Customer Feedback</span>
      <span className="hex-mono text-[10px]" style={{ color: "var(--hex-ink-muted)" }}>
        published
      </span>
    </div>

    <div className="space-y-5 p-4 sm:p-5">
      {/* Public link */}
      <div>
        <div className="hex-select-label">Public link</div>
        <div className="flex items-center gap-2">
          <div
            className="hex-mono flex min-w-0 flex-1 items-center rounded-md border hex-line-soft bg-[#fafaf7] px-3 py-2 text-[11px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            <span className="truncate">canvasflow.app/forms/customer-feedback</span>
          </div>
          <button
            className="shrink-0 rounded-md px-3 py-2 text-[11px] font-medium text-white"
            style={{ background: "var(--hex-ink)" }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* QR + access controls. The QR column is a fixed 104px, which leaves
          too little for the toggle rows beside it on a phone — below sm the
          two stack and the QR is capped so it doesn't blow up full-width. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[104px_1fr]">
        <div className="max-w-35 sm:max-w-none">
          <div className="hex-select-label">QR code</div>
          <div
            className="grid grid-cols-7 gap-0.75 rounded-md border hex-line-soft bg-white p-2"
            aria-hidden
          >
            {/* Deterministic pattern so server and client markup match. */}
            {Array.from({ length: 49 }).map((_, i) => (
              <span
                key={i}
                className="aspect-square rounded-[1px]"
                style={{
                  background: (i * 7 + Math.floor(i / 7) * 3) % 5 < 2 ? "var(--hex-ink)" : "transparent",
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="hex-select-label">Access</div>
          <div className="space-y-2">
            {[
              { l: "Accepting responses", v: "On", on: true },
              { l: "Expires", v: "31 Aug 2026", on: true },
              { l: "Max submissions", v: "500", on: true },
              { l: "One response per visitor", v: "On", on: true },
            ].map((row) => (
              <div
                key={row.l}
                className="flex items-center justify-between rounded-md border hex-line-soft bg-[#fafaf7] px-3 py-2"
              >
                <span className="text-[11px]" style={{ color: "var(--hex-ink-soft)" }}>
                  {row.l}
                </span>
                <span className="flex items-center gap-2">
                  <span className="hex-mono text-[10px] font-semibold">{row.v}</span>
                  <span
                    className="h-3 w-6 rounded-full p-0.5"
                    style={{ background: row.on ? "var(--c-teal)" : "rgba(26,29,41,0.18)" }}
                  >
                    <span
                      className="block h-2 w-2 rounded-full bg-white"
                      style={{ marginLeft: row.on ? "auto" : undefined }}
                    />
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="hex-mono flex items-center justify-between border-t hex-line-soft pt-3 text-[10px]"
        style={{ color: "var(--hex-ink-muted)", borderTopWidth: 1 }}
      >
        <span>328 / 500 submissions</span>
        <span>closes in 32 days</span>
      </div>
    </div>
  </div>
);

/* ── Step cards ────────────────────────────────────────────────────── */

const FeatureStepCard = ({
  n,
  t,
  d,
  illustration,
}: {
  n: string;
  t: string;
  d: string;
  illustration: React.ReactNode;
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="group hex-card relative flex flex-col overflow-hidden transition-all duration-500 hover:bg-[#eae8e2] hover:shadow-[0_32px_64px_-16px_rgba(26,29,41,0.2)]"
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply transition-opacity duration-500 group-hover:opacity-[0.15]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />

    <div className="relative flex h-52 items-center justify-center border-b hex-line-soft bg-[#fdfdfb] transition-colors duration-500 group-hover:bg-transparent sm:h-64">
      <div className="hex-grid-fine pointer-events-none absolute inset-0 opacity-[0.03]" />
      {/* The illustrations are drawn at a fixed 224x160. Scaling the whole
          group down on small screens keeps their internal proportions
          intact, which reflowing their parts would not. */}
      <div className="relative z-10 origin-center scale-[0.82] transform transition-transform duration-700 ease-out group-hover:scale-[0.9] sm:scale-100 sm:group-hover:scale-110">
        {illustration}
      </div>
    </div>
    <div className="relative z-20 flex grow flex-col p-6 sm:p-8 lg:p-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1 w-1 rounded-full bg-foreground opacity-20" />
        <div className="hex-mono text-[10px] font-bold tracking-[0.25em] uppercase opacity-40">
          Step / {n}
        </div>
      </div>
      <h3 className="mb-3 text-[22px] leading-tight font-semibold tracking-tight sm:mb-4 sm:text-[26px]">{t}</h3>
      <p className="text-[15px] leading-relaxed text-muted-foreground/80 transition-colors duration-500 group-hover:text-foreground/90 sm:text-[16px]">
        {d}
      </p>

      <div className="mt-auto flex items-center justify-between pt-6 transition-transform duration-500 group-hover:translate-x-1 sm:pt-10">
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          Learn More
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border hex-line-strong transition-all duration-500 group-hover:bg-foreground group-hover:text-background">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ── Step illustrations ────────────────────────────────────────────── */

const BuildIllustration = () => (
  <div className="relative flex h-40 w-56 items-center justify-center">
    <div className="absolute inset-0 flex items-center justify-center opacity-10">
      <div
        className="h-full w-full border hex-line-soft"
        style={{
          background: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      />
    </div>
    <div className="relative flex h-12 w-44 items-center gap-2 overflow-hidden rounded border hex-line-strong bg-white p-2 shadow-lg">
      <div className="absolute top-0 left-0 h-full w-1 bg-emerald-500" />
      <span className="hex-mono text-[10px] font-bold opacity-30">›</span>
      <div className="flex grow flex-col gap-1.5">
        <div className="h-1.5 w-28 rounded bg-slate-100" />
        <div className="h-1.5 w-16 rounded bg-slate-50" />
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      </div>
    </div>
    <div className="absolute top-6 right-4 flex h-10 w-10 rotate-12 items-center justify-center rounded-lg border border-indigo-100">
      <div className="h-4 w-4 rounded-sm border border-indigo-200" />
    </div>
    <div className="absolute bottom-4 left-6 flex h-8 w-8 -rotate-12 items-center justify-center rounded-full border border-slate-200">
      <div className="h-3 w-3 rounded-full bg-slate-100" />
    </div>
  </div>
);

const ShareIllustration = () => (
  <div className="relative flex h-40 w-56 items-center justify-center">
    <svg className="absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 200 150" aria-hidden>
      <path d="M0 100 L200 100 M0 120 L200 120 M0 140 L200 140" stroke="currentColor" strokeWidth="1" />
      <path
        d="M20 150 L80 80 M60 150 L100 80 M100 150 L120 80 M140 150 L140 80 M180 150 L160 80"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
    <div className="relative z-10 flex h-24 w-36 flex-col gap-3 rounded-lg border hex-line-strong bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between border-b hex-line-soft pb-2">
        <div className="h-2 w-16 rounded bg-slate-100" />
        <div className="h-2 w-2 rounded-full bg-indigo-500" />
      </div>
      <div className="space-y-2">
        <div className="h-1.5 w-full rounded bg-slate-50" />
        <div className="h-1.5 w-3/4 rounded bg-slate-50" />
      </div>
      <div className="mt-auto flex gap-2">
        <div className="hex-mono rounded-lg bg-slate-900 px-2 py-1 text-[8px] font-bold text-white">
          COPY LINK
        </div>
        <div className="h-4 w-8 rounded-lg bg-slate-100" />
      </div>
    </div>
    <div className="absolute top-8 right-10 h-3 w-3 rounded-full border border-indigo-200 bg-indigo-100" />
    <div className="absolute bottom-10 left-12 h-2 w-2 rounded-full bg-slate-200" />
  </div>
);

const SignalIllustration = () => (
  <div className="relative flex h-40 w-56 items-center justify-center">
    <div className="absolute inset-0 flex items-center justify-center opacity-5">
      <div
        className="h-full w-full"
        style={{
          background:
            "repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 1px, transparent 20px)",
        }}
      />
    </div>
    <div className="relative h-28 w-40 overflow-hidden rounded-lg border hex-line-soft bg-white/50 p-4 shadow-inner backdrop-blur-sm">
      <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d5cf6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2d5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 45 Q 15 40, 25 30 T 50 25 T 75 15 T 100 5 L 100 60 L 0 60 Z" fill="url(#waveGrad)" />
        <path
          d="M0 45 Q 15 40, 25 30 T 50 25 T 75 15 T 100 5"
          fill="none"
          stroke="#2d5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          className="hex-line-path"
        />
        <circle cx="20" cy="35" r="1.5" fill="#10b981" />
        <circle cx="45" cy="28" r="1.5" fill="#94a3b8" />
        <circle cx="70" cy="18" r="1.5" fill="#ef4444" />
        <circle cx="90" cy="8" r="1.5" fill="#6366f1" />
      </svg>
    </div>
    <div className="hex-mono absolute -top-2 right-12 rounded border hex-line-strong bg-white px-1.5 py-0.5 text-[8px] font-bold shadow-sm">
      LIVE
    </div>
    <div className="hex-mono absolute bottom-6 left-8 rounded border hex-line-strong bg-white px-1.5 py-0.5 text-[8px] font-bold shadow-sm">
      87%
    </div>
  </div>
);

/* ── Alternating feature block ─────────────────────────────────────── */

const FeatureBlock = ({
  id,
  glyph,
  title,
  body,
  cta,
  mock,
  reverse,
}: {
  id?: string;
  glyph: string;
  title: React.ReactNode;
  body: string;
  cta: string;
  mock: React.ReactNode;
  reverse?: boolean;
}) => {
  const { userInfo: user } = useGetLoggedInUserInfo();
  const router = useRouter();

  return (
    <section
      id={id}
      className="relative overflow-hidden border-b hex-line-soft py-14 sm:py-16 lg:py-20"
      style={{ borderBottomWidth: 1 }}
    >
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className={cn(
            "grid items-center gap-10 sm:gap-14 lg:items-start lg:gap-20",
            reverse
              ? "lg:grid-cols-[1.8fr_1fr] lg:[&>*:first-child]:order-2"
              : "lg:grid-cols-[1fr_1.8fr]",
          )}
        >
          <div className="max-w-lg lg:pt-4">
            <div className="mb-4 flex items-center gap-3 sm:mb-6">
              <GeoGlyph />
              <span className="hex-fig">FIG.{glyph}</span>
            </div>
            <h2 className="text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[38px] sm:leading-[1.02] sm:tracking-[-0.035em] lg:text-[48px]">{title}</h2>
            <p className="mt-5 text-[16px] leading-relaxed sm:mt-8 sm:text-[18px]" style={{ color: "var(--hex-ink-soft)" }}>
              {body}
            </p>
            <div className="mt-8 flex items-center gap-6 sm:mt-12">
              <button
                onClick={() => router.push(user ? "/dashboard" : "/signUp")}
                className="hex-btn-primary px-6 py-3 text-[14px] sm:px-8"
              >
                {cta} →
              </button>
            </div>
          </div>

          <div className="relative flex w-full min-w-0 justify-center">
            <div className="relative w-full max-w-full min-w-0">{mock}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Index;
