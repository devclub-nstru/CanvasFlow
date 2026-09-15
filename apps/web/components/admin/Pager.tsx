"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pager({
  page,
  pageCount,
  total,
  noun,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  noun: string;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 border-t px-4 py-3"
      style={{ borderTopColor: "var(--cf-line)" }}
    >
      <p className="cf-meta" style={{ color: "var(--cf-ink-soft)" }}>
        Page {page + 1} of {pageCount} · {total} {noun}
        {total === 1 ? "" : "s"}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
          className="cf-btn-outline h-8 gap-1 px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
          className="cf-btn-outline h-8 gap-1 px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
