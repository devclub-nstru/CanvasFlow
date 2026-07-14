"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Daylight-style floating navigation:
 *   - Centered white pill, 8px radius, soft shadow + 1px hairline ring
 *   - Plain text links (no underline / no chips)
 *   - Single flat solid-orange "Get started" CTA on the right
 */
export function LandingNavSunset({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
      <nav
        aria-label="Primary"
        className="flex items-center gap-3 sm:gap-6 md:gap-10 bg-white rounded-lg pl-4 sm:pl-5 pr-1.5 py-1.5 shadow-[0_10px_30px_-12px_rgba(22,19,17,0.18)] ring-1 ring-[color:var(--cf-line-strong)] max-w-[calc(100vw-2rem)]"
      >
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Home">
          <Image src="/logo.svg" alt="" width={22} height={22} className="object-contain" />
          <span className="cf-display text-[18px] sm:text-[19px] leading-none text-[color:var(--cf-ink)]">
            CanvasFlow
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Product", href: "#how-it-works" },
            { label: "Story", href: "#story" },
            { label: "About", href: "#about" },
            { label: "Brand", href: "#brand" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[14px] text-[color:var(--cf-ink)] hover:opacity-70 transition-opacity"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          href={isLoggedIn ? "/dashboard" : "/signUp"}
          className="inline-flex items-center justify-center h-[38px] sm:h-[42px] px-4 sm:px-6 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-[6px] text-[13px] sm:text-[14px] font-medium tracking-tight transition-colors whitespace-nowrap shrink-0"
        >
          {isLoggedIn ? "Dashboard" : "Get started"}
        </Link>
      </nav>
    </header>
  );
}
