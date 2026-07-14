"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useInView } from "motion/react";

/**
 * Daylight-style "How it works" section:
 *   - Cream background, large editorial serif headline on the left
 *   - 3 stacked "step" cards on the right with eyebrow + title + body
 *   - Scroll-triggered animations: left intro fades + slides up, step cards
 *     stagger up as they enter view, the chart's bars grow from the baseline.
 */
const STEPS = [
  {
    n: "step 1",
    h: "Open the canvas",
    s: "A canvas you can sketch on",
    body: "Drag fields onto an open canvas, connect them like nodes, and watch logic appear in the same place as layout.",
    cta: { label: "Get your estimate", href: "/signUp" },
  },
  {
    n: "Step 2",
    h: "We handle the wiring",
    s: "CanvasFlow handles everything",
    body: "Field keys are slugged into permanent identifiers the moment you create them. Rename labels freely; your endpoints, exports, and webhooks keep flowing.",
  },
  {
    n: "Step 3",
    h: "Publish & measure",
    s: "Responses you control",
    body: "Share a single link. Submissions, devices, and conversion rates light up your dashboard the instant they arrive.",
    chart: true,
  },
];

// Default ease used across this section — smooth, slightly snappy.
const EASE = [0.22, 1, 0.36, 1] as const;

export function HowItWorks({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section
      id="how-it-works"
      className="relative bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)]"
    >
      <PageGuides />
      <div className="relative mx-auto w-full max-w-[1320px] px-4 sm:px-6 md:px-8 py-20 sm:py-24 lg:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* LEFT: title + lead (fades + slides up as it enters view) */}
          <motion.div
            className="lg:col-span-5 lg:sticky lg:top-32 self-start"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">How CanvasFlow Works</p>
            <h2 className="mt-4 sm:mt-5 cf-display text-[36px] sm:text-[52px] md:text-[64px] lg:text-[72px] leading-[0.95]">
              A new way to build
              <span className="block">your forms</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[color:var(--cf-ink-soft)]">
              With CanvasFlow, your form generates and stores responses with durable keys and
              real-time analytics. We cover the infrastructure and upfront setup. You get instant
              publishing and below-spreadsheet pricing.
            </p>
            <Link
              href={isLoggedIn ? "/dashboard" : "/signUp"}
              className="mt-8 inline-flex items-center gap-1.5 h-[44px] px-6 bg-[color:var(--cf-ink)] hover:bg-black text-white rounded-full text-[13.5px] font-medium tracking-tight transition-colors"
            >
              See if your form qualifies
              <ArrowUpRight className="size-4" />
            </Link>
          </motion.div>

          {/* RIGHT: stacked step cards (each animates in on scroll) */}
          <ol className="lg:col-span-7 space-y-6 list-none">
            {STEPS.map((step, i) => (
              <motion.li
                key={i}
                className="relative bg-white rounded-[18px] p-5 sm:p-7 md:p-9 ring-1 ring-[color:var(--cf-line)] shadow-[0_30px_60px_-40px_rgba(22,19,17,0.25)]"
                initial={{ opacity: 0, y: 48 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
              >
                <div className="flex items-start justify-between gap-4 sm:gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="cf-eyebrow text-[color:var(--cf-orange)]">{step.n}</p>
                    <h3 className="mt-3 sm:mt-4 cf-display text-[22px] sm:text-[26px] md:text-[30px] leading-tight">
                      {step.h}
                    </h3>
                    <h4 className="mt-1.5 text-[16px] sm:text-[18px] font-medium text-[color:var(--cf-ink-soft)]">
                      {step.s}
                    </h4>
                    <p className="mt-3 sm:mt-4 text-[14px] sm:text-[14.5px] leading-relaxed text-[color:var(--cf-ink-soft)] max-w-md">
                      {step.body}
                    </p>
                    {step.cta && (
                      <Link
                        href={step.cta.href}
                        className="mt-5 sm:mt-6 inline-flex items-center gap-1.5 h-[40px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13px] font-medium transition-colors"
                      >
                        {step.cta.label}
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                  <span className="cf-display text-[44px] sm:text-[60px] md:text-[80px] leading-none text-[color:var(--cf-line-strong)] select-none shrink-0">
                    0{i + 1}
                  </span>
                </div>

                {step.chart && <StepChart />}
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PageGuides() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-0 w-px bg-[color:var(--cf-line)]" />
      <div className="absolute inset-y-0 left-1/4 w-px bg-[color:var(--cf-line)]" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--cf-line)]" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-[color:var(--cf-line)]" />
      <div className="absolute inset-y-0 right-0 w-px bg-[color:var(--cf-line)]" />
    </div>
  );
}

function StepChart() {
  // weekday bar chart — bars grow from the baseline once it enters the viewport.
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heights = [22, 38, 30, 52, 44, 60, 35];
  const maxH = 64; // px — track height of the chart row

  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div
      ref={ref}
      className="mt-8 bg-[color:var(--cf-cream)] rounded-[14px] p-5 ring-1 ring-[color:var(--cf-line)]"
    >
      <div className="flex items-baseline justify-between">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Response Earnings</p>
        <motion.p
          className="text-[13px] font-medium text-[color:var(--cf-ink-soft)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          +12.4%
        </motion.p>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <motion.span
          className="cf-display text-[34px] leading-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: inView ? 1 : 0,
            y: inView ? 0 : 10,
          }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        >
          2,418
        </motion.span>
        <motion.span
          className="text-[13px] text-[color:var(--cf-ink-soft)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          responses
        </motion.span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 items-end" style={{ height: `${maxH}px` }}>
        {heights.map((h, i) => (
          <motion.div
            key={i}
            className="rounded-sm bg-[color:var(--cf-orange)]/85 origin-bottom"
            style={{ height: `${h}px` }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{
              scaleY: inView ? 1 : 0,
              opacity: inView ? 1 : 0,
            }}
            transition={{
              duration: 0.7,
              ease: EASE,
              delay: 0.25 + i * 0.06,
            }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 text-[10px] text-[color:var(--cf-ink-soft)]/70 font-mono">
        {days.map((d, i) => (
          <motion.span
            key={d}
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: 0.4, delay: 0.55 + i * 0.04 }}
          >
            {d}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
