"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, Clock, Send, Trophy, X, CheckCircle2 } from "lucide-react";
import { MentiSlide } from "~/lib/menti";
import type { QuizResponseResult, QuizSessionState } from "~/hooks/useMentiRealtime";

interface Props {
  slide: MentiSlide;
  onSubmit: (val: any) => void;
  hasSubmitted?: boolean;
  quizState?: QuizSessionState | null;
  lastResponseResult?: QuizResponseResult | null;
}

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
    slide.responseSettings?.timeToRespondSeconds ||
    30;

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    lastResponseResult?.selectedOptionId || null
  );
  const [isSubmitted, setIsSubmitted] = useState<boolean>(hasSubmitted);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const startTimeRef = useRef<number>(Date.now());

  // Reset when slide changes
  useEffect(() => {
    setSelectedOptionId(null);
    setIsSubmitted(false);
  }, [slide.id]);

  // Countdown timer synced with server endsAt
  useEffect(() => {
    const mountTime = Date.now();
    startTimeRef.current = mountTime;
    const fallbackEndsAt = mountTime + timeLimit * 1000;

    const computeTimeLeft = () => {
      if (quizState?.endsAt) {
        const diff = Math.ceil((new Date(quizState.endsAt).getTime() - Date.now()) / 1000);
        return Math.max(0, diff);
      }
      const localDiff = Math.ceil((fallbackEndsAt - Date.now()) / 1000);
      return Math.max(0, localDiff);
    };

    const initial = computeTimeLeft();
    setTimeLeft(initial);

    const interval = setInterval(() => {
      const remaining = computeTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [slide.id, timeLimit, quizState?.endsAt]);

  const isTimerEnded = timeLeft === 0 || Boolean(quizState?.isLocked);
  const isLocked = isSubmitted || hasSubmitted || isTimerEnded;
  const hasResult = lastResponseResult !== null && lastResponseResult !== undefined;

  const handleSelectOption = (optionId: string) => {
    if (isLocked) return;
    setSelectedOptionId(optionId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId || isLocked) return;

    setIsSubmitted(true);
    const timeTakenMs = Date.now() - startTimeRef.current;

    onSubmit({
      optionId: selectedOptionId,
      timeTakenMs,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-full space-y-4 sm:space-y-5 select-none animate-in fade-in duration-200"
    >
      {/* 1. Header with Question & Timer */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="cf-meta text-(--cf-orange)">Quiz Question</span>
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 font-mono font-bold ${
              timeLeft <= 5 && timeLeft > 0
                ? "bg-rose-50 border-rose-500 text-rose-700 animate-pulse text-sm"
                : "bg-white border-(--cf-line-strong) cf-raised text-(--cf-ink) text-xs sm:text-sm"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-(--cf-orange) stroke-[2.5]" />
            <span className="tabular-nums">{timeLeft}s</span>
          </div>
        </div>

        <h2 className="text-base sm:text-lg md:text-xl font-bold leading-snug text-(--cf-ink)">
          {slide.question || "Select the correct answer"}
        </h2>
        <p className="cf-meta text-[11px] text-(--cf-ink-soft)">
          {isLocked ? "Response locked in" : "Select one option and submit"}
        </p>
      </div>

      {/* 2. Options Choice Cards */}
      <div className="space-y-2 sm:space-y-2.5 max-h-[46vh] sm:max-h-[50vh] overflow-y-auto pr-1">
        {options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          const letter = optionLetters[index] || String(index + 1);

          return (
            <button
              key={option.id}
              type="button"
              disabled={isLocked}
              onClick={() => handleSelectOption(option.id)}
              className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all min-h-[52px] ${
                isSelected
                  ? "bg-white border-2 border-(--cf-ink) cf-raised ring-1 ring-(--cf-ink)"
                  : isLocked
                  ? "bg-neutral-100 border-neutral-200 opacity-60 cursor-not-allowed"
                  : "bg-white border-(--cf-line-strong) hover:border-(--cf-ink) hover:bg-(--cf-cream) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`size-6 sm:size-7 shrink-0 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-colors ${
                    isSelected
                      ? "bg-(--cf-ink) text-white"
                      : "bg-(--cf-cream) text-(--cf-ink) border border-(--cf-line)"
                  }`}
                >
                  {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : letter}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-(--cf-ink) break-words line-clamp-3">
                  {option.label || `Option ${index + 1}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Submit Button (When not yet submitted and timer active) */}
      {!isLocked && (
        <div className="pt-1">
          <button
            type="submit"
            disabled={!selectedOptionId}
            className="cf-btn cf-raised cf-press w-full py-3.5 sm:py-4 px-4 text-sm sm:text-base font-bold justify-center rounded-(--hex-radius) disabled:opacity-40 disabled:cursor-not-allowed shadow-md min-h-[48px]"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Answer
          </button>
        </div>
      )}

      {/* 4. Post-submission Feedback (Before Timer Ends) */}
      {isLocked && !isTimerEnded && (
        <div className="p-3.5 bg-white border border-(--cf-line-strong) cf-raised rounded-xl text-center space-y-0.5 animate-in fade-in">
          <p className="text-xs font-bold text-(--cf-ink) font-mono">Answer locked in</p>
          <p className="text-[11px] text-(--cf-ink-soft)">
            Waiting for timer ({timeLeft}s) to reveal results...
          </p>
        </div>
      )}

      {/* 4. Score Result Reveal (When Timer Ends) */}
      {isTimerEnded && hasResult && (
        <div className="p-4 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-xl text-center space-y-2 animate-in fade-in">
          <div className="flex items-center justify-center gap-2">
            {lastResponseResult?.isCorrect ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-500 text-emerald-800 rounded-full text-xs font-mono font-bold">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Correct! +{lastResponseResult.pointsAwarded ?? 0} pts</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-400 text-rose-800 rounded-full text-xs font-mono font-bold">
                <X className="w-3.5 h-3.5 stroke-[3]" />
                <span>Incorrect (0 pts)</span>
              </span>
            )}
          </div>

          {typeof lastResponseResult?.totalScore === "number" && (
            <div className="pt-2 border-t border-(--cf-line) flex items-center justify-center gap-1.5 text-xs font-mono text-(--cf-ink)">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Total Score: <strong>{lastResponseResult.totalScore.toLocaleString()} pts</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

