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
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" style={{ color: accent }} />
        </div>
        <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink)">
          Rating Submitted!
        </h3>
        <p className="mt-1 text-xs text-(--cf-ink-soft)">
          Look at the big screen to see the live rating distribution.
        </p>
      </div>
    );
  }

  const isLargeRange = count > 5;

  return (
    <div className="flex flex-col w-full space-y-5">
      {/* Question Header */}
      <div className="space-y-0.5">
        <h2 className="text-lg font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {slide.question || `Rate on a scale from ${min} to ${max}`}
        </h2>
        <p className="text-xs text-(--cf-ink-soft)">
          Select a score from {min} to {max}
        </p>
      </div>

      {/* Rating Spectrum Buttons (Adaptive Grid for 1-5, 1-7, 1-10, etc.) */}
      <div className="space-y-3">
        <div
          className={`grid gap-1.5 sm:gap-2 ${
            count <= 5
              ? `grid-cols-${count}`
              : count <= 7
              ? "grid-cols-4 sm:grid-cols-7"
              : "grid-cols-5 sm:grid-cols-10"
          }`}
          style={{
            gridTemplateColumns:
              count <= 5
                ? `repeat(${count}, minmax(0, 1fr))`
                : count <= 7
                ? undefined
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
                  isLargeRange ? "py-3 sm:py-4" : "py-4 sm:py-5"
                } rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
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
                    isLargeRange ? "w-4 h-4" : "w-5 h-5"
                  }`}
                  style={{
                    color: isSelected ? accent : "#d1d5db",
                    fill: isSelected ? accent : "none",
                  }}
                />
                <span
                  className={`font-mono font-black ${
                    isLargeRange ? "text-sm sm:text-base" : "text-base sm:text-lg"
                  }`}
                >
                  {num}
                </span>
              </button>
            );
          })}
        </div>

        {/* Low / High Spectrum Labels */}
        <div className="flex justify-between text-[11px] sm:text-xs font-bold uppercase tracking-wider text-(--cf-ink-soft) px-1">
          <span>
            {lowLabel} ({min})
          </span>
          <span>
            {highLabel} ({max})
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        disabled={rating === null}
        onClick={() => {
          if (rating !== null) onSubmit(rating);
        }}
        className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3 px-4 font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-md mt-2"
      >
        <Send className="w-4 h-4" />
        Submit Rating {rating !== null ? `(${rating})` : ""}
      </button>
    </div>
  );
}
