"use client";

import React from "react";
import Image from "next/image";

/**
 * Daylight-style footer:
 *  - Cream paper background
 *  - Logo wordmark on the left
 *  - Huge serif "More Forms" wordmark
 *  - Copyright line at the bottom
 */
export function FooterSunset() {
  return (
    <footer className="bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] border-t border-[color:var(--cf-line)]">
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 md:px-8 pt-16 pb-10">
        <div className="flex flex-col gap-12">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="CanvasFlow"
              width={36}
              height={36}
              className="object-contain"
            />
            <span className="cf-display text-[26px] leading-none">CanvasFlow</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 md:gap-10">
            <h2 className="cf-display text-[64px] sm:text-[100px] md:text-[140px] lg:text-[180px] leading-[0.85] text-[color:var(--cf-ink)]">
              More Forms
            </h2>

            {/* small editorial colophon to balance the right side */}
            <aside className="md:max-w-[260px] md:pb-6 md:text-right shrink-0 space-y-3">
              <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Colophon</p>
              <p className="text-[13.5px] leading-relaxed text-[color:var(--cf-ink-soft)]">
                A studio for makers of beautiful data. Drafted in cream paper, shipped on the open
                canvas.
              </p>
              <p className="inline-flex items-center gap-2 text-[12px] font-mono text-[color:var(--cf-ink)] md:justify-end">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--cf-orange)] opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--cf-orange)]" />
                </span>
                Studio · live
              </p>
            </aside>
          </div>

          <p className="text-[12px] text-[color:var(--cf-ink-soft)]/70 border-t border-[color:var(--cf-line)] pt-6">
            &copy; 2026 CanvasFlow Studio. Built for makers of beautiful data.
          </p>
        </div>
      </div>
    </footer>
  );
}
