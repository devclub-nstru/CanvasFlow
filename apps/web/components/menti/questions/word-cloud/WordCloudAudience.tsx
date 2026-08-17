"use client";

import React, { useState, useEffect } from "react";
import { MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2, Plus } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (words: string[]) => void;
  hasSubmitted?: boolean;
}

export function WordCloudAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const isInfinite = Boolean(
    slide.responseSettings?.multipleSubmissions === true ||
      slide.responseSettings?.maxEntriesPerParticipant === 0
  );

  const [currentWord, setCurrentWord] = useState("");
  const [hasSubmittedAtLeastOnce, setHasSubmittedAtLeastOnce] = useState(false);

  // Reset local state when slide ID changes
  useEffect(() => {
    setCurrentWord("");
    setHasSubmittedAtLeastOnce(false);
  }, [slide.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = currentWord.trim();
    if (!trimmed) return;

    onSubmit([trimmed]);
    setHasSubmittedAtLeastOnce(true);
    setCurrentWord("");
  };

  // If single response mode and already submitted, show waiting screen
  if (!isInfinite && hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold tracking-[-0.03em] text-(--cf-ink)">
            Response Submitted!
          </h3>
          <p className="text-xs sm:text-sm text-(--cf-ink-soft) max-w-xs mx-auto leading-relaxed">
            Please wait for the presenter to move to the next question...
          </p>
        </div>
      </div>
    );
  }

  const isValid = currentWord.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full space-y-4 select-none">
      {/* 1. Question Header */}
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg md:text-xl font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {slide.question || "What word comes to mind?"}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-(--cf-ink-soft)">
          <span>Enter your answer below</span>
        </div>
      </div>

      {/* 2. Single Clean Input Field */}
      <div className="space-y-2">
        <input
          type="text"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          placeholder="Type a word or short phrase..."
          maxLength={40}
          autoFocus
          className="w-full p-3.5 text-base bg-white border-2 border-neutral-200 rounded-xl text-(--cf-ink) placeholder:text-(--cf-ink-soft) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)/20 font-medium shadow-inner"
        />
        <div className="flex justify-between items-center px-1 text-[11px] text-(--cf-ink-soft)">
          <span>Max 40 characters</span>
          <span>{currentWord.length}/40</span>
        </div>
      </div>

      {/* 3. Action Button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={!isValid}
          className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-md min-h-[48px]"
        >
          {isInfinite && hasSubmittedAtLeastOnce ? (
            <>
              <Plus className="w-4 h-4 mr-0.5" />
              Submit Another Word
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              Submit Word
            </>
          )}
        </button>
      </div>
    </form>
  );
}
