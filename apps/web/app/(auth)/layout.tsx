"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import Noise from "~/components/Noise";
import { HorizontalScale, HorizontalScaleDark, VerticalScaleDark } from "~/components/Scale";

const PANEL_POINTS: [string, string][] = [
  ["01", "Twelve field types, drag to reorder"],
  ["02", "One question at a time for whoever fills it in"],
  ["03", "Live analytics and drop-off per question"],
  ["04", "Share by link or QR, close it when you're done"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignUp = pathname?.startsWith("/signUp");

  return (
    <div className="hex-theme relative flex min-h-screen font-sans">
      <Noise />
      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <aside className="relative hidden w-[52%] flex-col overflow-hidden bg-[#0e0e0e] lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <VerticalScaleDark className="pointer-events-none absolute inset-y-0 left-0" />
        <VerticalScaleDark className="pointer-events-none absolute inset-y-0 right-0" />

        <HorizontalScaleDark />

        <div className="relative z-10 flex flex-1 flex-col px-12 py-12 xl:px-16 xl:py-14">
          <Link href="/" className="group mb-auto w-fit">
            <span className="text-[15px] font-bold tracking-[-0.04em] text-white transition-opacity group-hover:opacity-70">
              CanvasFlow
            </span>
          </Link>

          <div className="mt-16 mb-12">
            <p className="hex-mono mb-5 text-[11px] tracking-[0.18em] uppercase text-white/30">
              FIG.AUTH
            </p>
            <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-white xl:text-[52px]">
              Forms,{" "}
              <em
                className="font-normal italic"
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  color: "var(--c-lavender)",
                }}
              >
                thoughtfully
              </em>
              <br />
              built for teams.
            </h1>
            <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-white/40">
              Build a form, publish it with a link, and watch the responses turn into a dashboard
              the moment they land.
            </p>
          </div>

          <div>
            {PANEL_POINTS.map(([n, label]) => (
              <div key={n} className="flex items-center gap-4 border-b border-white/6 py-3.5">
                <span className="hex-mono w-5 shrink-0 text-[10px] text-white/45">{n}</span>
                <div className="h-3.5 w-px shrink-0 bg-white/15" />
                <span className="text-[13px] text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <HorizontalScaleDark />
      </aside>

      {/* ── Form panel ──────────────────────────────────────────────── */}
      <div className="hex-paper relative flex min-h-screen flex-1 flex-col overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <HorizontalScale />

        <nav
          className="relative z-10 border-b hex-line-soft"
          style={{ borderBottomWidth: 1, background: "var(--hex-nav)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-10">
            <Link href="/" className="text-[15px] font-bold tracking-[-0.04em] lg:hidden">
              CanvasFlow
            </Link>
            <span className="hidden lg:block" />
            <p
              className="hex-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ color: "var(--hex-ink-muted)" }}
            >
              {isSignUp ? "Create a new account" : "Sign in to your account"}
            </p>
          </div>
        </nav>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-10 sm:py-14">
          <div className="flex w-full max-w-125 flex-col">{children}</div>
        </div>

        <div className="relative z-10">
          <HorizontalScale />
        </div>
      </div>
    </div>
  );
}
