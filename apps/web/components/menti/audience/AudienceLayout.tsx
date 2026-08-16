"use client";

import React, { useState } from "react";
import { MentiPresentation } from "~/lib/menti";
import { SlideAudienceInput } from "../questions/registry";
import { ThumbsUp, Heart, Smile } from "lucide-react";
import Noise from "~/components/Noise";

interface Props {
  presentation: MentiPresentation;
  activeSlideIndex?: number;
}

export function AudienceLayout({ presentation, activeSlideIndex = 0 }: Props) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const currentSlide = presentation.slides[activeSlideIndex] || presentation.slides[0];

  const handleVoteSubmit = (val: any) => {
    setHasSubmitted(true);
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-(--cf-cream) text-(--cf-ink) select-none pb-8 relative">
      <Noise />

      {/* Mobile Top Header */}
      <header className="flex items-center justify-between w-full max-w-md px-5 py-3.5 bg-(--cf-cream-2) border-b border-(--cf-line-strong) z-10">
        <div className="flex items-center gap-2">
          <div className="size-2.5 bg-(--cf-orange) rounded-sm" />
          <h1 className="text-xs font-bold truncate max-w-[220px] text-(--cf-ink)">
            {presentation.title}
          </h1>
        </div>
        <span className="cf-meta text-[10px] font-bold text-(--cf-ink) bg-white px-2 py-0.5 rounded border border-(--cf-line)">
          PIN: {presentation.joinCode}
        </span>
      </header>

      {/* Main Question Card Container */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-md p-4 sm:p-6 z-10">
        <div className="cf-panel cf-raised p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl">
          {currentSlide ? (
            <SlideAudienceInput
              slide={currentSlide}
              onSubmit={handleVoteSubmit}
              hasSubmitted={hasSubmitted}
            />
          ) : (
            <div className="text-center p-8 text-(--cf-ink-soft) text-sm">
              Waiting for presenter to show next slide...
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Reaction Bar */}
      <footer className="flex items-center gap-3 p-1.5 bg-white border border-(--cf-line-strong) cf-raised rounded-full z-10">
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-(--cf-orange) hover:bg-(--cf-cream) rounded-full transition-transform active:scale-125"
          title="Thumbs up"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-rose-600 hover:bg-rose-50 rounded-full transition-transform active:scale-125"
          title="Heart"
        >
          <Heart className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-amber-600 hover:bg-amber-50 rounded-full transition-transform active:scale-125"
          title="Smile"
        >
          <Smile className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
