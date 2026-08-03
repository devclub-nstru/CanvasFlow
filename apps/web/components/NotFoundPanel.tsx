"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

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

  const [mounted, setMounted] = useState(false);
  const [cause, setCause] = useState(CAUSES[0]!);

  useEffect(() => {
    setMounted(true);
    setCause(CAUSES[Math.floor(Math.random() * CAUSES.length)]!);
  }, []);

  useEffect(() => {
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
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-label="404"
            >
              {glitch}
            </p>
            <div className="mt-2 h-2 w-full" style={{ background: "var(--hex-ink)" }} aria-hidden />
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
          <ArrowLeft
            className="size-5 transition-transform group-hover:-translate-x-1"
            aria-hidden
          />
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
