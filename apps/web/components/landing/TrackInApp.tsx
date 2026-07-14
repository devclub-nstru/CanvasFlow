"use client";

import React from "react";
import Image from "next/image";

/**
 * "Track every submission" section — Daylight's "Track it all in the app" twin.
 *  - Cream background, centered serif headline
 *  - A right-hand desk illustration to keep the editorial scene
 *  - Bottom area is intentionally airy (paper-like), like the reference
 */
export function TrackInApp() {
  return (
    <section className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] overflow-hidden">
      <div className="relative mx-auto w-full max-w-[1320px] px-0 border-t border-[color:var(--cf-line)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {/* left: empty paper column (desktop only) */}
          <div className="hidden md:block min-h-[460px] border-r border-[color:var(--cf-line)]" />

          {/* center: text */}
          <div className="min-h-[320px] md:min-h-[460px] md:border-r border-[color:var(--cf-line)] flex flex-col items-center justify-center text-center px-6 sm:px-8 py-12 md:py-0">
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Control</p>
            <h2 className="mt-4 sm:mt-5 cf-display text-[30px] sm:text-[40px] md:text-[46px] leading-[1.04]">
              Track it all in the
              <span className="block">CanvasFlow app</span>
            </h2>
          </div>

          {/* right: desk illustration */}
          <div className="relative min-h-[280px] md:min-h-[460px] aspect-[4/3] md:aspect-auto overflow-hidden bg-[#d8c4a4]">
            <Image
              src="/new-image-3.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        {/* a quieter under-row to keep the airy paper feel (desktop only) */}
        <div className="hidden md:grid grid-cols-3 gap-0 border-t border-[color:var(--cf-line)]">
          <div className="aspect-[5/2] border-r border-[color:var(--cf-line)]" />
          <div className="aspect-[5/2] border-r border-[color:var(--cf-line)]" />
          <div className="aspect-[5/2]" />
        </div>
      </div>
    </section>
  );
}
