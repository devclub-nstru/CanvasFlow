"use client";

import React from "react";
import Link from "next/link";
import { Play, BarChart2 } from "lucide-react";

interface Props {
  presentationId: string;
}

export function ResultsEmptyState({ presentationId }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-(--cf-cream) select-none">
      <div className="cf-panel cf-raised max-w-xl w-full p-10 sm:p-14 text-center space-y-6 bg-white rounded-3xl border-2 border-(--cf-line-strong) animate-in fade-in zoom-in-95 duration-200">
        {/* Graphic Icon Container */}
        <div className="size-20 mx-auto rounded-2xl bg-blue-50 border border-(--cf-line) text-(--cf-orange) flex items-center justify-center shadow-xs">
          <BarChart2 className="w-10 h-10 stroke-[2]" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <span className="cf-eyebrow text-(--cf-ink-soft)">
            Empty results
          </span>
          <h2 className="cf-display text-2xl sm:text-3xl text-(--cf-ink)">
            No results yet<span className="text-(--cf-orange)">.</span>
          </h2>
          <p className="text-xs sm:text-sm text-(--cf-ink-soft) max-w-md mx-auto leading-relaxed">
            Check back after presenting your Menti to see a live breakdown of participant answers, vote counts, and analytics here.
          </p>
        </div>

        {/* Start Presentation CTA */}
        <div className="pt-2">
          <Link
            href={`/menti/${presentationId}/present`}
            className="cf-btn cf-raised cf-press inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-full"
          >
            <Play className="w-4 h-4 fill-white" />
            Start presentation
          </Link>
        </div>
      </div>
    </div>
  );
}
