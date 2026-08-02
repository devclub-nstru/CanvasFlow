"use client";

import React from "react";
import Image from "next/image";

interface FormHeaderProps {
  progressPercent: number;
  submitted: boolean;
  formCode: string;
  formTitle?: string;
}

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
          <span className="cf-display truncate text-[16px] leading-none text-(--cf-ink)">
            {formTitle || "CanvasFlow"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] tabular-nums text-(--cf-ink-soft)">
            {pct}%
          </span>
          <span
            className="border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.16em] text-(--cf-ink-soft)"
            style={{ borderColor: "var(--cf-line-strong)" }}
          >
            {formCode}
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Form progress"
        className="h-3.5 w-full overflow-hidden border bg-(--cf-ink)/4"
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
