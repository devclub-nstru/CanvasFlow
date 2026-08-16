"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { SlideQuestionViewer } from "../questions/registry";
import { BarGraphEditor } from "../questions/bar-graph/BarGraphEditor";
import { Pencil, CornerDownLeft, Sparkles, Star, QrCode } from "lucide-react";
import { toast } from "sonner";

interface Props {
  slide?: MentiSlide | null;
  joinCode?: string;
  isInspectorOpen?: boolean;
  onOpenNewSlideModal: () => void;
  onChange?: (updated: Partial<MentiSlide>) => void;
}

export function SlideCanvasStage({
  slide,
  joinCode = "8239 2324",
  isInspectorOpen = true,
  onOpenNewSlideModal,
  onChange,
}: Props) {
  // If the slide is unconfigured / new or has default placeholder, show the 3 creation cards
  const isInitialState = !slide || (!slide.question && slide.options?.length === 0);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-(--cf-cream) overflow-hidden relative select-none">
      {isInitialState ? (
        /* Empty / Initial Choice Screen (Exact Screenshot Match) */
        <div className="flex flex-col items-center justify-center w-full max-w-4xl animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
            {/* 1. Start from scratch */}
            <button
              type="button"
              onClick={onOpenNewSlideModal}
              className="cf-panel cf-raised cf-press flex flex-col items-center text-center p-8 bg-white rounded-3xl border border-(--cf-line-strong) transition-all group"
            >
              <div className="size-16 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Pencil className="w-8 h-8 rotate-12" />
              </div>
              <h3 className="text-base font-bold text-(--cf-ink) mb-2">
                Start from scratch
              </h3>
              <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
                Gain insights with word clouds, polls, quizzes, and more.
              </p>
            </button>

            {/* 2. Import slides */}
            <button
              type="button"
              onClick={() => toast.info("Slide import (PPTX/PDF) coming soon!")}
              className="cf-panel cf-raised cf-press flex flex-col items-center text-center p-8 bg-white rounded-3xl border border-(--cf-line-strong) transition-all group"
            >
              <div className="size-16 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CornerDownLeft className="w-8 h-8 -rotate-45" />
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <h3 className="text-base font-bold text-(--cf-ink)">Import slides</h3>
                <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              </div>
              <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
                Upload a Powerpoint, Keynote, or PDF file to Mentimeter.
              </p>
            </button>

            {/* 3. Start with AI */}
            <button
              type="button"
              onClick={() => toast.info("AI Survey Generator coming soon!")}
              className="cf-panel cf-raised cf-press flex flex-col items-center text-center p-8 bg-white rounded-3xl border border-(--cf-line-strong) transition-all group"
            >
              <div className="size-16 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-(--cf-ink) mb-2">
                Start with AI
              </h3>
              <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
                Use AI to build personalized quizzes, polls and surveys!
              </p>
            </button>
          </div>
        </div>
      ) : (
        /* Active 16:9 Presentation Stage (Maximized, Scales smoothly when right sidebar is collapsed/expanded) */
        <div
          className={`relative flex flex-col items-center justify-center w-full aspect-[16/9] bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
            isInspectorOpen
              ? "max-w-5xl 2xl:max-w-6xl max-h-[82vh] p-6 sm:p-10"
              : "max-w-6xl 2xl:max-w-7xl max-h-[86vh] p-8 sm:p-12"
          }`}
        >
          {/* Render Slide — editable canvas variant for BAR_GRAPH, read-only viewer for others */}
          <div className="w-full h-full flex items-center justify-center transition-all duration-300">
            {slide?.type === "BAR_GRAPH" && onChange ? (
              <BarGraphEditor slide={slide} onChange={onChange} variant="canvas" />
            ) : (
              <SlideQuestionViewer slide={slide} isPreview={true} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
