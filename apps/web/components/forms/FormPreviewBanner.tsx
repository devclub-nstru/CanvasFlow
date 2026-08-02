"use client";

import React from "react";
import { Eye } from "lucide-react";

export function FormPreviewBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full border-b"
      style={{
        borderBottomColor: "var(--cf-line-strong)",
        background: "var(--cf-ink)",
        color: "var(--cf-cream)",
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
          <Eye className="size-3.5" />
          Preview
        </span>
        <span className="text-[12.5px] leading-relaxed opacity-90">
          Fill it in and submit to test the flow — nothing is saved and no response is recorded.
        </span>
      </div>
    </div>
  );
}
