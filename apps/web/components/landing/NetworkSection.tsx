"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Daylight's "A growing network — Every home makes the network stronger" block,
 * reframed for CanvasFlow: every published form strengthens the shared studio.
 */
export function NetworkSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section
      id="about"
      className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] border-t border-[color:var(--cf-line)]"
    >
      <div className="relative mx-auto w-full max-w-[1320px] px-4 sm:px-6 md:px-8 py-20 sm:py-24 lg:py-36 text-center">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">A growing studio</p>
        <h2 className="mx-auto mt-5 sm:mt-6 cf-display text-[36px] sm:text-[56px] md:text-[68px] lg:text-[76px] leading-[0.96] max-w-3xl">
          Every form makes
          <span className="block">the studio stronger</span>
        </h2>
        <p className="mx-auto mt-5 sm:mt-6 max-w-xl text-[14px] sm:text-[15px] leading-relaxed text-[color:var(--cf-ink-soft)]">
          CanvasFlow forms generate, store, and share fields locally to your workspace. Together
          they form a studio that scales with every new template and route you publish.
        </p>
        <Link
          href={isLoggedIn ? "/dashboard" : "/signUp"}
          className="mt-10 inline-flex items-center gap-1.5 h-[44px] px-6 bg-[color:var(--cf-ink)] hover:bg-black text-white rounded-full text-[13.5px] font-medium tracking-tight transition-colors"
        >
          See if your form qualifies
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
