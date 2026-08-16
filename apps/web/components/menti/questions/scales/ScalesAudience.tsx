"use client";

import React, { useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { CheckCircle2, Star } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (rating: number) => void;
  hasSubmitted?: boolean;
}

export function ScalesAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const lowLabel = slide.responseSettings.ratingLowLabel || "Low";
  const highLabel = slide.responseSettings.ratingHighLabel || "High";

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mb-3 text-green-600 animate-bounce" />
        <h3 className="text-xl font-bold text-neutral-900">Score Submitted!</h3>
        <p className="mt-1 text-sm text-neutral-500">Look at the big screen to see the average rating.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-snug text-neutral-900">{slide.question}</h2>
        <p className="text-xs text-neutral-500">Rate from 1 to 5</p>
      </div>

      {/* 1-5 Rating Spectrum Buttons */}
      <div className="space-y-3">
        <div className="flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = rating === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setRating(num)}
                className={`flex-1 py-5 rounded-2xl font-bold text-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-md scale-105"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <Star
                  className={`w-5 h-5 ${
                    isSelected ? "text-amber-500 fill-amber-500" : "text-neutral-300"
                  }`}
                />
                <span>{num}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between text-xs font-semibold text-neutral-400 px-1">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={rating === null}
        onClick={() => {
          if (rating !== null) onSubmit(rating);
        }}
        className="flex items-center justify-center w-full py-3.5 px-4 font-semibold text-white transition-all bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md"
      >
        Submit Rating ({rating || "-"})
      </button>
    </div>
  );
}
