"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, Clock, Lock, Sparkles, Zap, Trophy, X } from "lucide-react";
import { MentiSlide } from "~/lib/menti";
import type { QuizResponseResult, QuizSessionState } from "~/hooks/useMentiRealtime";

interface Props {
  slide: MentiSlide;
  onSubmit: (val: any) => void;
  hasSubmitted?: boolean;
  quizState?: QuizSessionState | null;
  lastResponseResult?: QuizResponseResult | null;
}

const colors = ["#2d5cf6", "#ff7378", "#9189eb", "#43b7a6", "#e4a23e", "#313c8e"];
const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function QuizAudience({
  slide,
  onSubmit,
  hasSubmitted = false,
  quizState,
  lastResponseResult,
}: Props) {
  const options = slide.options || [];
  const timeLimit =
    slide.quizSettings?.timeLimitSeconds ||
    slide.responseSettings.timeToRespondSeconds ||
    30;
  const isTimeBased =
    slide.quizSettings?.gradingScheme === "time_based" ||
    (slide.responseSettings.scoreAllocation !== "fixed" &&
      slide.responseSettings.scoreAllocation !== "none");

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    lastResponseResult?.selectedOptionId || null
  );
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const startTimeRef = useRef<number>(Date.now());

  // Countdown timer synced with server endsAt
  useEffect(() => {
    startTimeRef.current = Date.now();

    const computeTimeLeft = () => {
      if (quizState?.endsAt) {
        const diff = Math.ceil((new Date(quizState.endsAt).getTime() - Date.now()) / 1000);
        return Math.max(0, diff);
      }
      return timeLimit;
    };

    const initial = computeTimeLeft();
    setTimeLeft(initial);

    const interval = setInterval(() => {
      const remaining = computeTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [slide.id, timeLimit, quizState?.endsAt]);

  const handleSelect = (optionId: string) => {
    if (hasSubmitted || selectedOptionId || timeLeft === 0 || quizState?.isLocked) return;

    setSelectedOptionId(optionId);
    const timeTakenMs = Date.now() - startTimeRef.current;

    onSubmit({
      optionId,
      timeTakenMs,
      timestamp: new Date().toISOString(),
    });
  };

  const isLocked =
    hasSubmitted ||
    Boolean(selectedOptionId) ||
    timeLeft === 0 ||
    Boolean(quizState?.isLocked);

  const isTimerEnded = timeLeft === 0 || Boolean(quizState?.isLocked);
  const hasResult = lastResponseResult !== null && lastResponseResult !== undefined;

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

      {/* 3. Post-submission / Post-timer Status Card */}
      {isLocked && !isTimerEnded && (
        <div className="cf-panel p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-center space-y-1 animate-in fade-in slide-in-from-bottom-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase font-mono tracking-wider">
            <Lock className="size-3.5" />
            <span>Answer locked in</span>
          </div>
          <p className="text-xs text-emerald-700">
            Waiting for timer ({timeLeft}s) to reveal the results...
          </p>
        </div>
      )}

      {/* 4. Revealed Score Breakdown (When timer has ended) */}
      {isTimerEnded && hasResult && (
        <div
          className={`cf-panel p-4 border-2 rounded-xl text-center space-y-2 animate-in fade-in zoom-in-95 ${
            lastResponseResult?.isCorrect
              ? "bg-emerald-50 border-emerald-500 text-emerald-900"
              : "bg-rose-50 border-rose-400 text-rose-900"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {lastResponseResult?.isCorrect ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
                <Check className="size-3.5 stroke-[3]" />
                <span>Correct! +{lastResponseResult.pointsAwarded ?? 0} pts</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
                <X className="size-3.5 stroke-[3]" />
                <span>Incorrect (0 pts)</span>
              </span>
            )}
          </div>

          {typeof lastResponseResult?.totalScore === "number" && (
            <div className="pt-2 border-t border-black/10 flex items-center justify-center gap-2 text-xs font-mono">
              <Trophy className="size-3.5 text-amber-600" />
              <span>Your total score: <strong>{lastResponseResult.totalScore.toLocaleString()} pts</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
