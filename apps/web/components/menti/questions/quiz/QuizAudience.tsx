"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, Clock, Lock, Sparkles, Zap } from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onSubmit: (val: any) => void;
  hasSubmitted?: boolean;
}

const colors = ["#2d5cf6", "#ff7378", "#9189eb", "#43b7a6", "#e4a23e", "#313c8e"];
const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function QuizAudience({ slide, onSubmit, hasSubmitted = false }: Props) {
  const options = slide.options || [];
  const timeLimit = slide.responseSettings.timeToRespondSeconds || 30;
  const isTimeBased = slide.responseSettings.scoreAllocation !== "fixed" && slide.responseSettings.scoreAllocation !== "none";

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setTimeLeft(timeLimit);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [slide.id, timeLimit]);

  const handleSelect = (optionId: string) => {
    if (hasSubmitted || selectedOptionId || timeLeft === 0) return;

    setSelectedOptionId(optionId);
    const timeTakenMs = Date.now() - startTimeRef.current;

    onSubmit({
      optionId,
      timeTakenMs,
      timestamp: new Date().toISOString(),
    });
  };

  const isLocked = hasSubmitted || Boolean(selectedOptionId) || timeLeft === 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 select-none animate-in fade-in duration-200">
      {/* 1. Header with Question and Countdown Status */}
      <div className="cf-panel cf-raised p-5 bg-white rounded-2xl border-2 border-(--cf-line-strong) text-center space-y-2">
        <div className="flex items-center justify-between">
          <span className="cf-meta text-(--cf-orange)">Quiz Question</span>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-mono font-bold ${
              timeLeft <= 5
                ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                : "bg-(--cf-cream) border-(--cf-line) text-(--cf-ink)"
            }`}
          >
            <Clock className="size-3" />
            <span>{timeLeft}s</span>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-bold leading-snug text-neutral-900 pt-1">
          {slide.question || "Select the correct answer"}
        </h2>

        {/* Speed / Points Bonus Note */}
        <div className="pt-2 border-t border-(--cf-line) flex items-center justify-center gap-1.5 text-xs font-mono text-(--cf-ink-soft)">
          {isTimeBased ? (
            <>
              <Zap className="size-3.5 text-amber-500 fill-amber-500" />
              <span>Answer fast for up to 1,000 points!</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 text-(--cf-orange)" />
              <span>Correct answer earns 1,000 points!</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Options Choice Cards */}
      <div className="space-y-3">
        {options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          const color = option.color || colors[index % colors.length];
          const letter = optionLetters[index] || String(index + 1);

          return (
            <button
              key={option.id}
              type="button"
              disabled={isLocked}
              onClick={() => handleSelect(option.id)}
              className={`w-full cf-raised p-4 rounded-xl border-2 transition-all flex items-center gap-3.5 text-left relative overflow-hidden group ${
                isSelected
                  ? "border-(--cf-orange) bg-blue-50 ring-2 ring-(--cf-orange) translate-x-1 translate-y-1 shadow-none"
                  : isLocked
                  ? "border-neutral-200 bg-neutral-100 opacity-60 cursor-not-allowed"
                  : "border-(--cf-line-strong) bg-white hover:bg-neutral-50 active:translate-x-1 active:translate-y-1 cursor-pointer"
              }`}
            >
              {/* Option Letter Badge */}
              <div
                className="size-9 rounded-lg flex items-center justify-center font-mono font-bold text-white text-sm shrink-0 shadow-xs"
                style={{ backgroundColor: color }}
              >
                {letter}
              </div>

              {/* Option Label */}
              <span className="flex-1 font-semibold text-sm sm:text-base text-neutral-900 leading-tight">
                {option.label}
              </span>

              {/* Selected Lock Badge */}
              {isSelected && (
                <div className="size-6 rounded-full bg-(--cf-orange) text-white flex items-center justify-center shrink-0 animate-in zoom-in-90">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Post-submission Confirmation Message */}
      {isLocked && (
        <div className="cf-panel p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-center space-y-1 animate-in fade-in slide-in-from-bottom-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase font-mono tracking-wider">
            <Lock className="size-3.5" />
            <span>Answer locked in</span>
          </div>
          <p className="text-xs text-emerald-700">
            {timeLeft > 0
              ? `Waiting for timer (${timeLeft}s) to reveal the results...`
              : "Time is up! Look at the main screen for results."}
          </p>
        </div>
      )}
    </div>
  );
}
