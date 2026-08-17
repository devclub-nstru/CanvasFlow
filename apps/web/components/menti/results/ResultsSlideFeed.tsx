"use client";

import React, { useEffect, useRef } from "react";
import { MentiPresentation, MentiSlide } from "~/lib/menti";
import { Users, Download, Lock, CheckCircle2, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ScalesViewer } from "../questions/scales/ScalesViewer";

interface Props {
  presentation: MentiPresentation;
  maxResponses?: number;
  onVisibleSlideChange?: (slideId: string) => void;
}

export function ResultsSlideFeed({
  presentation,
  maxResponses,
  onVisibleSlideChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up intersection observer to detect active slide in view
  useEffect(() => {
    if (!onVisibleSlideChange) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisibleSlideChange(entry.target.id);
          }
        });
      },
      { root: containerRef.current, threshold: 0.5 }
    );

    presentation.slides.forEach((slide) => {
      const el = document.getElementById(`results-slide-${slide.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [presentation.slides, onVisibleSlideChange]);

  return (
    <main
      ref={containerRef}
      className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 select-none bg-(--cf-cream)"
    >
      {/* 1. Feed Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-(--cf-line-strong) max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <h2 className="cf-display text-xl sm:text-2xl text-(--cf-ink)">
            Responses
          </h2>
        </div>

        <button
          type="button"
          onClick={() => toast.info("Exporting all responses to CSV...")}
          className="cf-btn-outline px-3 py-1.5 text-xs font-semibold rounded-(--hex-radius) flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export All (CSV)
        </button>
      </div>

      {/* 2. Slide Results Cards List */}
      <div className="space-y-6 max-w-4xl mx-auto">
        {presentation.slides.map((slide, index) => (
          <SlideResultCard
            key={slide.id}
            slide={slide}
            index={index}
            participantCount={presentation.participantCount}
          />
        ))}
      </div>
    </main>
  );
}

/* ─── Individual Slide Card ─────────────────────────────────────────── */

function SlideResultCard({
  slide,
  index,
  participantCount,
}: {
  slide: MentiSlide;
  index: number;
  participantCount: number;
}) {
  const total =
    typeof slide.totalResponses === "number" && slide.totalResponses > 0
      ? slide.totalResponses
      : (slide.options || []).reduce((acc, o) => acc + (o.voteCount || 0), 0);
  const maxOptionVotes = Math.max(...(slide.options || []).map((o) => o.voteCount || 0), 1);

  return (
    <div
      id={`results-slide-${slide.id}`}
      className="cf-panel cf-raised p-6 bg-white rounded-2xl border-2 border-(--cf-line-strong) space-y-6"
    >
      {/* 1. Card Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-(--cf-line)">
        <div className="flex items-start gap-3 min-w-0">
          <span className="cf-meta size-7 shrink-0 rounded-(--hex-radius) bg-(--cf-cream) border border-(--cf-line-strong) flex items-center justify-center font-bold text-xs text-(--cf-ink)">
            {index + 1}
          </span>
          <div className="space-y-0.5">
            <h3 className="font-bold text-base text-(--cf-ink) leading-snug">
              {slide.question || "Untitled question"}
            </h3>
            {slide.description && (
              <p className="text-xs text-(--cf-ink-soft)">{slide.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-(--cf-ink-soft) font-mono bg-(--cf-cream) px-2.5 py-1 rounded-(--hex-radius) border border-(--cf-line)">
            <Users className="w-3.5 h-3.5 text-(--cf-ink)" />
            <span className="font-bold text-(--cf-ink)">{total}</span> / {participantCount}
          </div>
          <button
            type="button"
            onClick={() => toast.info(`Exporting data for slide ${index + 1}...`)}
            className="p-1.5 text-(--cf-ink-soft) hover:text-(--cf-ink) hover:bg-(--cf-cream) rounded transition-colors"
            title="Download slide data"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Card Body Visualization */}
      <div className="space-y-3">
        {slide.type === "BAR_GRAPH" && (
          <div className="space-y-3">
            {slide.options.map((opt) => {
              const count = opt.voteCount || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const fillPct = total > 0 ? (count / maxOptionVotes) * 100 : 0;

              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-(--cf-ink) truncate max-w-md">{opt.label}</span>
                    <span className="text-(--cf-ink-soft) font-mono tabular-nums">
                      <strong className="text-(--cf-ink)">{count}</strong> ({pct}%)
                    </span>
                  </div>
                  {/* Visual Bar Track */}
                  <div className="h-3 w-full bg-(--cf-cream) rounded-full overflow-hidden border border-(--cf-line)">
                    <div
                      className="h-full bg-(--cf-orange) rounded-full transition-all duration-500"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {slide.type === "WORD_CLOUD" && (
          <div className="p-4 bg-(--cf-cream-2) rounded-xl border border-(--cf-line) flex flex-wrap items-center justify-center gap-3 min-h-[120px]">
            {slide.options.map((opt, i) => {
              const count = opt.voteCount || 0;
              const ratio = count / maxOptionVotes;
              const fontSize = 12 + Math.round(ratio * 16); // 12px to 28px range

              return (
                <div
                  key={i}
                  className="cf-panel cf-raised px-3 py-1.5 bg-white rounded-lg border border-(--cf-line-strong) flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <span
                    className="font-bold text-(--cf-ink)"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {opt.label}
                  </span>
                  <span className="cf-meta text-[9px] px-1.5 py-0.2 rounded-full bg-(--cf-orange) text-white font-bold">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {slide.type === "SCALES" && (
          <div className="p-4 sm:p-6 bg-(--cf-cream-2) rounded-xl border border-(--cf-line) overflow-hidden flex flex-col items-center">
            <ScalesViewer
              slide={slide}
              isPreview={false}
              showQuestion={false}
            />
          </div>
        )}
      </div>

      {/* 3. Card Footer Tags */}
      <div className="pt-3 border-t border-(--cf-line) flex items-center justify-between text-xs text-(--cf-ink-soft)">
        <div className="flex items-center gap-2">
          <span className="cf-meta uppercase text-[10px] px-2 py-0.5 rounded bg-(--cf-cream) border border-(--cf-line) font-bold text-(--cf-ink)">
            {slide.type.replace("_", " ")}
          </span>
          {slide.responseSettings.multipleSelection && (
            <span className="cf-meta text-[10px] text-(--cf-ink-soft)">Multi-choice</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Responses recorded</span>
        </div>
      </div>
    </div>
  );
}
