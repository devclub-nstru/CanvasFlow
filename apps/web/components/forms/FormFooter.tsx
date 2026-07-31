"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function FormFooter() {
  return (
    <footer className="w-full max-w-2xl flex items-center justify-center gap-3 pt-4 pb-2 text-[11px] font-mono text-(--cf-ink-soft)">
      <span>Built with</span>
      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1 text-(--cf-ink) hover:text-(--cf-orange) transition-colors"
      >
        CanvasFlow
        <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </footer>
  );
}
