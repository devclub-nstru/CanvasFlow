"use client";

import React from "react";
import Image from "next/image";

interface FormHeaderProps {
  progressPercent: number;
  submitted: boolean;
  formCode: string;
  formTitle?: string;
}

/**
 * Sticky header for the public form: brand, form code, and progress.
 *
 * Restyled from the supplied reference. The progress bar is the reference's
 * `border-2 border-current h-4` block rather than the 1px pill this used to
 * be — at 4px inside a drawn box it reads as a gauge from across the room,
 * which is the point of putting it above a one-question-at-a-time flow.
 *
 * Square corners and hard edges throughout, matching the `--hex-radius: 0`
 * rule the rest of the app follows.
 */
export function FormHeader({ progressPercent, submitted, formCode, formTitle }: FormHeaderProps) {
  const pct = submitted ? 100 : progressPercent;

  return (
    <header className="w-full max-w-2xl space-y-3">
      <div className="flex items-end justify-between gap-4">
        {/* brand */}
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/logo.svg"
            alt=""
            width={20}
            height={20}
            className="shrink-0 object-contain"
          />
          <span className="cf-display truncate text-[16px] leading-none text-[color:var(--cf-ink)]">
            {formTitle || "CanvasFlow"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] tabular-nums text-[color:var(--cf-ink-soft)]">
            {pct}%
          </span>
          <span
            className="border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--cf-ink-soft)]"
            style={{ borderColor: "var(--cf-line-strong)" }}
          >
            {formCode}
          </span>
        </div>
      </div>

      {/* Progress. `aria-*` on the track so a screen reader gets the number
          without having to infer it from a decorative div. */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Form progress"
        className="h-3.5 w-full overflow-hidden border bg-[color:var(--cf-ink)]/[0.04]"
        style={{ borderColor: "var(--cf-line-strong)" }}
      >
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: "var(--cf-orange)" }}
        />
      </div>
    </header>
  );
}
