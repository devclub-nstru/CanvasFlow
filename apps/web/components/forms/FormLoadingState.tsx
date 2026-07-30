"use client";

import React from "react";

export function FormLoadingState() {
  return (
    <div
      className="cf-landing cf-dotgrid flex min-h-screen w-full items-center justify-center"
      style={{ background: "var(--cf-cream)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)]" />
        <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-[color:var(--cf-ink-soft)] uppercase">
          Loading form
        </span>
      </div>
    </div>
  );
}
