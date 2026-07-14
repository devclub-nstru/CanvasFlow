"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Daylight's giant "Step into Daylight" hero-finale block, restated for us.
 * Big serif title, centered logo, an editorial paragraph, then a CTA.
 */
export function StepIntoCanvasFlow({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section
      id="brand"
      className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] border-t border-[color:var(--cf-line)]"
    >
      <div className="relative mx-auto w-full max-w-[1320px] px-4 sm:px-6 md:px-8 py-20 sm:py-28 lg:py-40">
        <h2 className="cf-display text-[48px] sm:text-[80px] md:text-[112px] lg:text-[128px] leading-[0.92] text-center">
          Step into
          <span className="block">CanvasFlow</span>
        </h2>

        <div className="mt-10 sm:mt-16 flex flex-col items-center gap-6 sm:gap-8">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16">
            <Image src="/logo.svg" alt="CanvasFlow" fill sizes="64px" className="object-contain" />
          </div>
          <h3 className="cf-display text-[24px] sm:text-[34px] leading-tight text-center max-w-md px-4">
            The canvas is bright
          </h3>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-[color:var(--cf-ink-soft)] text-center max-w-md px-4">
            Ready to take control of your forms? It&apos;s time to step out of spreadsheet templates
            and into a more resilient, real-time data future.
          </p>
          <Link
            href={isLoggedIn ? "/dashboard" : "/signUp"}
            className="inline-flex items-center justify-center h-[48px] px-7 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[14px] font-medium transition-colors"
          >
            {isLoggedIn ? "Open dashboard" : "See if you qualify"}
          </Link>
        </div>
      </div>
    </section>
  );
}
