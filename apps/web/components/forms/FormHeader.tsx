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
    <header className="w-full max-w-2xl flex items-center justify-between gap-4">
      {/* brand */}
      <div className="flex items-center gap-2 min-w-0">
        <Image src="/logo.svg" alt="" width={20} height={20} className="object-contain shrink-0" />
        <span className="cf-display text-[16px] leading-none text-[color:var(--cf-ink)] truncate">
          {formTitle || "CanvasFlow"}
        </span>
      </div>

      {/* progress + code */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline-flex items-center gap-2 cf-eyebrow text-[color:var(--cf-ink-soft)]">
          <span>{pct}%</span>
        </span>
        <div className="w-20 sm:w-28 h-1 rounded-full bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[color:var(--cf-orange)] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{formCode}</span>
      </div>
    </header>
  );
}
