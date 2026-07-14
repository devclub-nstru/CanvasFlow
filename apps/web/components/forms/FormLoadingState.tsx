"use client";

import React from "react";

export function FormLoadingState() {
  return (
    <div className="cf-landing min-h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] animate-spin" />
        <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Loading form...</span>
      </div>
    </div>
  );
}
