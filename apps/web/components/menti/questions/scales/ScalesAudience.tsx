"use client";

import React, { useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { CheckCircle2, Star, Send } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (rating: number) => void;
  hasSubmitted?: boolean;
}

export function ScalesAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const [rating, setRating] = useState<number | null>(null);

  // Reset rating when slide changes
  React.useEffect(() => {
    setRating(null);
  }, [slide.id]);
  const min =
    slide.responseSettings?.minRating !== undefined
      ? slide.responseSettings.minRating
      : 1;
  const max =
    slide.responseSettings?.maxRating !== undefined
      ? slide.responseSettings.maxRating
      : 5;
  const count = Math.max(2, max - min + 1);
  const ratingNumbers = Array.from({ length: count }, (_, i) => min + i);

  const lowLabel = slide.responseSettings?.ratingLowLabel || "Low";
  const highLabel = slide.responseSettings?.ratingHighLabel || "High";

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold tracking-[-0.03em] text-(--cf-ink)">
            Rating Submitted!
          </h3>
          <p className="text-xs sm:text-sm text-(--cf-ink-soft) max-w-xs mx-auto leading-relaxed">
            Please wait for the presenter to go to the next question...
          </p>
        </div>
      </div>
    );
  }

  const isFiveOrFewer = count <= 5;

  return (
    <div className="flex flex-col w-full space-y-4 sm:space-y-5 select-none">
      {/* Question Header */}
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg md:text-xl font-bold leading-snug text-(--cf-ink)">
          {slide.question || `Rate on a scale from ${min} to ${max}`}
        </h2>
        <div className="flex items-center justify-between">
          <p className="cf-meta text-[11px] text-(--cf-ink-soft)">
            Select a score from {min} to {max}
          </p>
          {rating !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-(--cf-ink) bg-amber-50 px-2 py-0.5 rounded border border-(--cf-orange)/40">
              <Star className="w-3 h-3 text-(--cf-orange) fill-(--cf-orange)" />
              <span>Score: {rating}</span>
            </span>
          )}
        </div>
      </div>

      {/* Rating Spectrum Tiles */}
      <div className="space-y-2.5 sm:space-y-3">
        {isFiveOrFewer ? (
          /* 1-5 Star Cards Grid */
          <div
            className="grid gap-2 sm:gap-2.5"
            style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
          >
            {ratingNumbers.map((num) => {
              const isSelected = rating === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setRating(num)}
                  className={`cf-panel cf-raised cf-press py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? "bg-(--cf-ink) text-white border-(--cf-ink) ring-2 ring-(--cf-orange) scale-105 shadow-md"
                      : "bg-white text-(--cf-ink) border-(--cf-line-strong) hover:border-(--cf-ink) hover:bg-(--cf-cream)"
                  }`}
                >
                  <Star
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                      isSelected ? "text-(--cf-orange) fill-(--cf-orange)" : "text-neutral-300"
                    }`}
                  />
                  <span className="font-mono font-black text-sm sm:text-base">
                    {num}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Flexible 2-Row Numeric Grid (5 per row for 1-10) without star clutter */
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
            {ratingNumbers.map((num) => {
              const isSelected = rating === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setRating(num)}
                  className={`cf-panel cf-raised cf-press py-3 sm:py-3.5 rounded-xl font-bold border-2 transition-all flex items-center justify-center ${
                    isSelected
                      ? "bg-(--cf-ink) text-white border-(--cf-ink) ring-2 ring-(--cf-orange) scale-105 shadow-md"
                      : "bg-white text-(--cf-ink) border-(--cf-line-strong) hover:border-(--cf-ink) hover:bg-(--cf-cream)"
                  }`}
                >
                  <span className="font-mono font-black text-base sm:text-lg">
                    {num}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Low / High Spectrum Labels */}
        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-(--cf-ink-soft) px-1">
          <span>
            {lowLabel} ({min})
          </span>
          <span>
            {highLabel} ({max})
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-1">
        <button
          type="button"
          disabled={rating === null}
          onClick={() => {
            if (rating !== null) onSubmit(rating);
          }}
          className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3.5 sm:py-4 px-4 text-sm sm:text-base font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-md min-h-[48px]"
        >
          <Send className="w-4 h-4 mr-1" />
          Submit Rating {rating !== null ? `(${rating})` : ""}
        </button>
      </div>
    </div>
  );
}
