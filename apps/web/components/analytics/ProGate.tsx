"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, Sparkles } from "lucide-react";

interface ProGateProps {
  /** True when the viewer's plan does not include detailed analytics. */
  locked: boolean;
  title: string;
  body: string;
  children: React.ReactNode;
}

/**
 * Plan gate for the detailed analytics sections.
 *
 * When locked it renders a blurred *placeholder* and an upgrade prompt — never
 * the real content behind a blur. Two reasons that matters:
 *
 *  1. A CSS blur is decoration, not access control. Real data blurred in the
 *     DOM is still readable in devtools and still arrived over the network, so
 *     "blur the section" implemented literally would leak exactly the numbers
 *     the plan is meant to sell.
 *  2. Blurred real content keeps its focusable children, so a keyboard user
 *     tabs into controls they cannot see. Substituting a static placeholder
 *     removes the problem instead of patching it with `aria-hidden`.
 *
 * The caller is responsible for not *fetching* the gated data when locked —
 * this component cannot un-request it. See `useGetProAnalytics` being passed an
 * empty id on the analytics page.
 */
export function ProGate({ locked, title, body, children }: ProGateProps) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative overflow-hidden">
      {/* Placeholder only — shaped like the real panels so the section reads as
          "there is something here", with no actual figures. */}
      <div
        aria-hidden
        className="pointer-events-none select-none blur-[6px]"
        style={{ filter: "blur(6px)" }}
      >
        <GatePlaceholder />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="cf-panel cf-raised max-w-sm p-6 text-center sm:p-8">
          <span
            className="mx-auto mb-4 flex size-10 items-center justify-center border"
            style={{ borderColor: "var(--cf-line-strong)", color: "var(--cf-orange)" }}
          >
            <Lock className="size-4" />
          </span>
          <p className="cf-meta" style={{ color: "var(--cf-orange)" }}>
            Pro+ feature
          </p>
          <h4 className="cf-display mt-2 text-[22px] leading-tight uppercase sm:text-[26px]">
            {title}
          </h4>
          <p
            className="mt-3 text-[13px] leading-relaxed"
            style={{ color: "var(--cf-ink-soft)" }}
          >
            {body}
          </p>
          <Link
            href="/dashboard/pricing"
            className="cf-btn cf-raised cf-press group mt-6 h-[38px] px-5 text-[12.5px]"
          >
            <Sparkles className="size-3.5" />
            Upgrade to Pro+
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Inert stand-in for a gated section: panel shapes and bars, no numbers. */
function GatePlaceholder() {
  const bars = [72, 58, 84, 41, 66, 30, 52];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {[0, 1].map((panel) => (
        <div key={panel} className="cf-panel p-5">
          <div
            className="h-2.5 w-24 rounded-sm"
            style={{ background: "var(--cf-line-strong)", opacity: 0.35 }}
          />
          <div
            className="mt-3 h-2 w-40 rounded-sm"
            style={{ background: "var(--cf-line-strong)", opacity: 0.18 }}
          />
          <div className="mt-6 flex h-40 items-end gap-2.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: `${panel === 0 ? h : bars[bars.length - 1 - i]}%`,
                  background: i % 3 === 0 ? "var(--cf-orange)" : "var(--cf-line-strong)",
                  opacity: i % 3 === 0 ? 0.5 : 0.28,
                }}
              />
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-16 rounded-sm"
                style={{ background: "var(--cf-line-strong)", opacity: 0.2 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
