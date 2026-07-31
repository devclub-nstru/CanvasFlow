"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

/* ── Adapted from the supplied reference ───────────────────────────────
   Structure kept: the badge on the panel corner, the oversized numeral with
   a rule under it, the "probable cause" box, the three-up data grid, the
   two big actions, and the mono meta line at the bottom.

   Changed on the way in:

   1 · Chrome. The reference is Neo-Brutalist and leans on `shadow-brutal`
       utilities that don't exist here. Restated in the `hex-*` paper-studio
       language used by /about, /learn-more and /docs.

   2 · Plumbing. `react-router-dom` useLocation/Link → `usePathname` and
       `next/link`; `framer-motion` → `motion` (this repo's package). The
       glitch is done with a state swap rather than a motion component, so
       it can be skipped outright under reduced-motion.

   3 · Voice. The reference is shouting spy-thriller in all-caps — "SYSTEM
       BREACH", "REBOOT REALITY", "© DEEP DATA SQUAD". This product's voice
       is dry and lowercase-ish, so the jokes stay and the volume comes down.

   4 · Usefulness. "SECURITY CLEARANCE: ZERO / VOID" is a gag with no
       information in it. A 404 is a dead end, so the panels and the link row
       carry the actual routes of this app instead, which is the one thing a
       lost visitor needs.

   5 · "Reboot reality" reloaded the page, which on a 404 just re-renders the
       404. It's `router.back()` now, which does something. */

/** Dry, and each one an actual reason a URL here would miss. */
const CAUSES = [
  "The link was mistyped, or it pointed somewhere that has since moved.",
  "An old bookmark, from before something got renamed.",
  "We changed a route and forgot to leave a forwarding address.",
  "A link from an email that was already stale when it was sent.",
];

const GLITCH_CHARS = "4Ø4#%§◊∆0";

export function NotFoundPanel() {
  const pathname = usePathname();
  const router = useRouter();

  const [glitch, setGlitch] = useState("404");

  /* `/_not-found` is prerendered at build time, so anything derived from the
     real URL — or from Math.random — has to land after mount or the static
     HTML and the first client render disagree and React logs a hydration
     mismatch. Both start empty/fixed and fill in from this effect. */
  const [mounted, setMounted] = useState(false);
  const [cause, setCause] = useState(CAUSES[0]!);

  useEffect(() => {
    setMounted(true);
    setCause(CAUSES[Math.floor(Math.random() * CAUSES.length)]!);
  }, []);

  useEffect(() => {
    // Anyone who has asked for less motion gets a numeral that just sits there.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let restore: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      setGlitch(
        Array.from(
          { length: 3 },
          () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]!,
        ).join(""),
      );
      restore = setTimeout(() => setGlitch("404"), 110);
    }, 3400);

    return () => {
      clearInterval(interval);
      clearTimeout(restore);
      setGlitch("404");
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
      {/* ── Main panel ─────────────────────────────────────────────── */}
      <div className="hex-card relative mt-4 p-6 pt-10 sm:p-10 sm:pt-12">
        {/* Corner badge. Inset on phones so it can't hang off the viewport
            the way a symmetric negative offset would. */}
        <div
          className="absolute -top-4 left-4 inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-semibold sm:-left-4"
          style={{
            borderColor: "var(--hex-line-strong)",
            borderWidth: 1,
            background: "var(--hex-ink)",
            color: "#fff",
          }}
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          Error 404
        </div>

        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:gap-12">
          {/* Numeral */}
          <div className="relative shrink-0">
            <p
              className="hex-mono text-[92px] leading-none font-bold tracking-tighter select-none sm:text-[128px]"
              /* The glitch swaps in symbols of differing widths; a tabular
                 figure keeps the block from reflowing on every tick. */
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-label="404"
            >
              {glitch}
            </p>
            <div
              className="mt-2 h-2 w-full"
              style={{ background: "var(--hex-ink)" }}
              aria-hidden
            />
          </div>

          {/* Copy */}
          <div className="min-w-0 flex-1 space-y-5">
            <div>
              <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[36px]">
                This page{" "}
                <em
                  className="font-normal italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  isn&rsquo;t here.
                </em>
              </h1>
              <div className="mt-3 flex items-center gap-2.5">
                <span
                  className="size-2 shrink-0 animate-pulse rounded-full"
                  style={{ background: "var(--cf-danger)" }}
                  aria-hidden
                />
                <span
                  className="hex-mono text-[11px] font-bold tracking-[0.15em] uppercase"
                  style={{ color: "var(--cf-danger)" }}
                >
                  No route matches
                </span>
              </div>
            </div>

            <div
              className="border-l bg-(--hex-surface) px-5 py-4"
              style={{ borderLeftWidth: 2, borderLeftColor: "var(--hex-line-strong)" }}
            >
              <span
                className="hex-mono mb-1.5 block text-[10px] font-bold tracking-[0.18em] uppercase"
                style={{ color: "var(--hex-ink-muted)" }}
              >
                Probable cause
              </span>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
                {cause}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Data grid ──────────────────────────────────────────────── */}
      <div
        className="mt-8 grid border-t border-l hex-line-strong sm:grid-cols-3"
        style={{ borderTopWidth: 1, borderLeftWidth: 1 }}
      >
        <div
          className="border-r border-b hex-line-strong p-5"
          style={{ borderRightWidth: 1, borderBottomWidth: 1, background: "var(--hex-ink)" }}
        >
          <p className="hex-mono mb-2 text-[10px] font-bold tracking-[0.18em] text-white/50 uppercase">
            Requested path
          </p>
          {/* Empty until mounted — see the hydration note above. */}
          <p className="hex-mono text-[12.5px] break-all text-white">
            {mounted ? pathname : "\u00a0"}
          </p>
        </div>

        <div
          className="border-r border-b hex-line-strong p-5"
          style={{ borderRightWidth: 1, borderBottomWidth: 1, background: "var(--hex-bone)" }}
        >
          <p
            className="hex-mono mb-2 text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Status
          </p>
          <p className="text-[13.5px] font-medium">404 · Not found</p>
        </div>

        <div
          className="border-r border-b hex-line-strong bg-white p-5"
          style={{ borderRightWidth: 1, borderBottomWidth: 1 }}
        >
          <p
            className="hex-mono mb-2 text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Nothing was lost
          </p>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            Your forms and responses are untouched.
          </p>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/"
          className="group inline-flex flex-1 items-center justify-center gap-3 border px-6 py-4 text-[16px] font-semibold transition-colors"
          style={{
            borderColor: "var(--hex-line-strong)",
            borderWidth: 1,
            background: "var(--hex-ink)",
            color: "#fff",
          }}
        >
          <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" aria-hidden />
          Back to home
        </Link>

        <button
          type="button"
          onClick={() => router.back()}
          className="hex-btn-ghost flex-1 px-6 py-4 text-[16px]"
        >
          Go back a page
        </button>
      </div>

      {/* ── Escape routes ──────────────────────────────────────────── */}
      <div className="mt-10 border-t hex-line-soft pt-6" style={{ borderTopWidth: 1 }}>
        <span className="hex-fig">OR TRY ONE OF THESE</span>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {[
            ["Docs", "/docs"],
            ["Learn more", "/learn-more"],
            ["About", "/about"],
            ["Your forms", "/dashboard/sketches"],
            ["Analytics", "/dashboard/analytics"],
            ["Pricing", "/dashboard/pricing"],
          ].map(([label, href]) => (
            <Link key={href} href={href!} className="hex-link text-[14px]">
              {label}
            </Link>
          ))}
        </div>

        <p
          className="mt-6 max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: "var(--hex-ink-soft)" }}
        >
          Opening a form someone sent you? A form that&rsquo;s closed, expired, or still a draft
          shows its own message rather than this page — so if you landed here, check the link itself
          against the one you were given.
        </p>
      </div>

      {/* ── Meta line ──────────────────────────────────────────────── */}
      <div
        className="hex-mono mt-12 flex flex-col gap-2 text-[10px] font-bold tracking-[0.3em] uppercase sm:flex-row sm:justify-between"
        style={{ color: "var(--hex-ink-muted)", opacity: 0.6 }}
      >
        <span>CanvasFlow · HTTP 404</span>
        <span>Forms, thoughtfully built</span>
      </div>
    </div>
  );
}
