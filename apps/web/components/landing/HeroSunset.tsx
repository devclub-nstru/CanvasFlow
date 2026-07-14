"use client";

import React from "react";
import Link from "next/link";
import { Snowflake } from "lucide-react";

/**
 * Daylight-style hero:
 *  - Full-bleed dark warm "golden-hour" backdrop (CSS-only, photo-feel)
 *  - Left content: small left gutter, vertically centered. Tiny uppercase
 *    eyebrow, huge serif headline, short sub-paragraph, address-style
 *    input pill with a dark CTA.
 *  - Right side: a solid-orange "energy panel" tile, vertically centered and
 *    docked to the right gutter. Stat rows sit above and below it. The only
 *    blueprint guide lines on the page are the 4 lines that exactly trace
 *    this panel's bounding box, extended off-screen to the viewport edges.
 */
export function HeroSunset({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative w-full overflow-hidden cf-hero-photo text-white min-h-screen">
      {/* photo-feel layered shadows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_8%,rgba(0,0,0,0.55),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,transparent_30%,transparent_65%,rgba(0,0,0,0.4)_100%)]" />
      <div className="pointer-events-none absolute inset-0 cf-grain opacity-30" />

      <div className="relative min-h-screen flex items-center px-6 sm:px-10 md:pl-16 md:pr-20 lg:pl-[100px] lg:pr-[140px] pt-24 sm:pt-28 pb-16 sm:pb-20">
        {/* ---- Left: headline + input (vertically centered, hugging the left gutter) ---- */}
        <div className="relative z-10 w-full max-w-2xl">
          <span className="cf-eyebrow text-white/85">Forms you control</span>
          <h1 className="mt-5 sm:mt-6 cf-display text-white text-[44px] sm:text-[64px] md:text-[88px] lg:text-[104px] leading-[0.92]">
            Build forms
            <span className="block">in golden hour.</span>
          </h1>
          <p className="mt-6 sm:mt-7 max-w-md text-[14px] sm:text-[15px] leading-relaxed text-white/85">
            Drag and drop builder, durable data keys, real-time analytics. Free to start — no credit
            card required.
          </p>

          <Link
            href={isLoggedIn ? "/dashboard" : "/signUp"}
            className="mt-7 sm:mt-8 inline-flex items-center justify-center h-[52px] w-full max-w-[320px] px-7 bg-[color:var(--cf-ink)] hover:bg-black text-white rounded-full text-[14px] font-medium tracking-tight transition-colors shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]"
          >
            {isLoggedIn ? "Open dashboard" : "Start building"}
          </Link>
        </div>

        {/* ---- Right: orange "energy panel" — vertically centered, docked to the right gutter ---- */}
        <aside className="absolute left-3/4 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden lg:block">
          <RightPanel />
        </aside>
      </div>
    </section>
  );
}

function RightPanel() {
  return (
    <div className="relative w-[260px] lg:w-[290px]">
      {/* ---- The only grid lines on the page: trace the orange tile's 4 edges
             and extend off-screen to the viewport edges. ---- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* horizontals along the orange tile's top & bottom */}
        <div className="absolute left-[-200vw] right-[-200vw] top-0 h-px bg-white/16" />
        <div className="absolute left-[-200vw] right-[-200vw] bottom-0 h-px bg-white/16" />
        {/* verticals along the orange tile's left & right edges */}
        <div className="absolute top-[-200vh] bottom-[-200vh] left-0 w-px bg-white/16" />
        <div className="absolute top-[-200vh] bottom-[-200vh] right-0 w-px bg-white/16" />
      </div>

      {/* top stat: "Responses today" */}
      <div className="absolute -top-20 left-0 right-0 flex items-start justify-between gap-4 text-white/90">
        <div>
          <p className="cf-eyebrow text-white/65 mb-1">Responses today</p>
          <p className="text-[15px] font-medium">2,418 · +12.4%</p>
        </div>
      </div>

      {/* the vivid orange tile */}
      <div className="relative w-full h-[380px] lg:h-[420px] rounded-[4px] overflow-hidden cf-orange-tile shadow-[0_30px_70px_-30px_rgba(246,111,0,0.7)] ring-1 ring-black/10">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.18)_0%,transparent_55%)]" />
      </div>

      {/* bottom: split labels */}
      <div className="absolute -bottom-20 left-0 right-0 flex items-end justify-between text-white/90">
        <div>
          <p className="cf-eyebrow text-white/65">Backup stored</p>
          <div className="mt-2 flex items-center gap-1">
            <span className="block w-7 h-1.5 rounded-sm bg-white/90" />
            <span className="block w-7 h-1.5 rounded-sm bg-white/35" />
          </div>
        </div>
        <div className="text-right">
          <p className="cf-eyebrow text-white/65 inline-flex items-center gap-1.5">
            <Snowflake className="size-3" /> Conversion
          </p>
          <p className="mt-1 text-[15px] font-medium">92%</p>
        </div>
      </div>
    </div>
  );
}
