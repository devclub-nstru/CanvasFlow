"use client";

import React, { useState } from "react";
import { MentiPresentation } from "~/lib/menti";
import { SlideAudienceInput } from "../questions/registry";
import { ThumbsUp, Heart, Smile } from "lucide-react";

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
    <div className="flex flex-col items-center justify-between min-h-screen bg-neutral-100 text-neutral-900 select-none pb-8">
      {/* Mobile Top Header */}
      <header className="flex items-center justify-between w-full max-w-md px-6 py-4 bg-white border-b border-neutral-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm" />
          <h1 className="text-xs font-bold truncate max-w-[200px] text-neutral-800">
            {presentation.title}
          </h1>
        </div>
        <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
          {presentation.joinCode}
        </span>
      </header>

      {/* Main Question Card Container */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-md p-6">
        <div className="p-6 bg-white border border-neutral-200 rounded-3xl shadow-lg">
          {currentSlide ? (
            <SlideAudienceInput
              slide={currentSlide}
              onSubmit={handleVoteSubmit}
              hasSubmitted={hasSubmitted}
            />
          ) : (
            <div className="text-center p-8 text-neutral-400 text-sm">
              Waiting for presenter to show next slide...
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Reaction Bar */}
      <footer className="flex items-center gap-4 p-2 bg-white/80 backdrop-blur-md border border-neutral-200 rounded-full shadow-md">
        <button
          onClick={() => {}}
          className="p-2.5 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-transform active:scale-125"
        >
          <ThumbsUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => {}}
          className="p-2.5 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-transform active:scale-125"
        >
          <Heart className="w-5 h-5" />
        </button>
        <button
          onClick={() => {}}
          className="p-2.5 text-neutral-600 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-transform active:scale-125"
        >
          <Smile className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
