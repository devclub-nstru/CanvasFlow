"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";

/**
 * Auth shell — Daylight-style.
 *  - Cream paper background, hairline ring, editorial serif copy
 *  - Left panel: a quiet brand column (md+ only) with the wordmark + a big
 *    serif quote + a small "live" status colophon at the bottom
 *  - Right panel: the form (signIn / signUp) centered on cream
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cf-landing min-h-screen w-full bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] antialiased">
      <div className="relative min-h-screen w-full flex flex-col md:flex-row">
        {/* LEFT: editorial brand panel (md+ only) */}
        <aside className="relative hidden md:flex md:w-1/2 lg:w-[45%] border-r border-[color:var(--cf-line)] flex-col justify-between p-10 lg:p-14 bg-[color:var(--cf-cream-2)] overflow-hidden">
          {/* faint blueprint guides */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/4 w-px bg-[color:var(--cf-line)]" />
            <div className="absolute inset-y-0 left-2/4 w-px bg-[color:var(--cf-line)]" />
            <div className="absolute inset-y-0 left-3/4 w-px bg-[color:var(--cf-line)]" />
          </div>

          {/* brand mark */}
          <Link
            href="/"
            className="relative inline-flex items-center gap-3 z-10"
            aria-label="CanvasFlow home"
          >
            <Image src="/logo.svg" alt="" width={32} height={32} className="object-contain" />
            <span className="cf-display text-[22px] leading-none">CanvasFlow</span>
          </Link>

          {/* big serif quote */}
          <div className="relative z-10 max-w-md">
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Welcome</p>
            <h2 className="mt-5 cf-display text-[44px] lg:text-[60px] leading-[0.95]">
              Build forms
              <span className="block">in golden hour.</span>
            </h2>
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-[color:var(--cf-ink-soft)]">
              A studio for makers of beautiful data. Sketch on an open canvas, ship durable forms,
              watch responses land in real time.
            </p>
          </div>

          {/* colophon */}
          <div className="relative z-10 flex items-center justify-between text-[12px] font-mono text-[color:var(--cf-ink-soft)]">
            <span className="inline-flex items-center gap-2 text-[color:var(--cf-ink)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--cf-orange)] opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--cf-orange)]" />
              </span>
              Studio · live
            </span>
            <span>© 2026</span>
          </div>
        </aside>

        {/* RIGHT: form */}
        <main className="relative flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
          {children}
        </main>
      </div>
    </div>
  );
}
