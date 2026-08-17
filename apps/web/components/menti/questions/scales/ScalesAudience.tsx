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
  const accent = slide.designSettings?.accentColor || "#e4a23e";

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7" style={{ color: accent }} />
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

  const isLargeRange = count > 5;

  return (
    <div className="flex flex-col w-full space-y-4 sm:space-y-5 select-none">
      {/* Question Header */}
      <div className="space-y-0.5">
        <h2 className="text-base sm:text-lg md:text-xl font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {slide.question || `Rate on a scale from ${min} to ${max}`}
        </h2>
        <p className="text-xs text-(--cf-ink-soft)">
          Select a score from {min} to {max}
        </p>
      </div>

      {/* Rating Spectrum Buttons (Adaptive Grid for 1-5, 1-7, 1-10, etc.) */}
      <div className="space-y-2.5 sm:space-y-3">
        <div
          className={`grid gap-1.5 sm:gap-2 ${
            count <= 5
              ? "grid-cols-5"
              : count <= 7
              ? "grid-cols-4 sm:grid-cols-7"
              : "grid-cols-5 sm:grid-cols-10"
          }`}
          style={{
            gridTemplateColumns:
              count <= 5
                ? `repeat(${count}, minmax(0, 1fr))`
                : undefined,
          }}
        >
          {ratingNumbers.map((num) => {
            const isSelected = rating === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setRating(num)}
                className={`cf-panel cf-raised cf-press ${
                  isLargeRange ? "py-2.5 sm:py-4" : "py-3.5 sm:py-5"
                } rounded-xl sm:rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${
                  isSelected
                    ? "border-(--cf-orange) bg-amber-50/80 text-(--cf-ink) ring-2 ring-(--cf-orange) scale-105"
                    : "border-(--cf-line-strong) bg-white text-(--cf-ink) hover:border-(--cf-ink)"
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: accent,
                        boxShadow: `0 0 0 2px ${accent}`,
                      }
                    : undefined
                }
              >
                <Star
                  className={`transition-transform ${
                    isLargeRange ? "w-3.5 sm:w-4 h-3.5 sm:h-4" : "w-4 sm:w-5 h-4 sm:h-5"
                  }`}
                  style={{
                    color: isSelected ? accent : "#d1d5db",
                    fill: isSelected ? accent : "none",
                  }}
                />
                <span
                  className={`font-mono font-black ${
                    isLargeRange ? "text-xs sm:text-base" : "text-sm sm:text-lg"
                  }`}
                >
                  {num}
                </span>
              </button>
            );
          })}
        </div>

        {/* Low / High Spectrum Labels */}
        <div className="flex justify-between text-[10px] sm:text-xs font-bold uppercase tracking-wider text-(--cf-ink-soft) px-1">
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
          className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3.5 px-4 text-xs sm:text-sm font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-md"
        >
          <Send className="w-4 h-4 mr-1" />
          Submit Rating {rating !== null ? `(${rating})` : ""}
        </button>
      </div>
    </div>
  );
}
