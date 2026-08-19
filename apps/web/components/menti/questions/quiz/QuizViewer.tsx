"use client";

import React, { useState, useEffect } from "react";
import { MentiSlide } from "~/lib/menti";
import { Check, Clock, EyeOff, X } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  hideResults?: boolean;
  showAsPercentage?: boolean;
  isRevealed?: boolean;
  onRevealAnswer?: () => void;
}

const colors = ["#2d5cf6", "#ff7378", "#9189eb", "#43b7a6", "#e4a23e", "#313c8e"];

function splitIntoBalancedRows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n <= 4) return [items];
  if (n === 5) return [items.slice(0, 3), items.slice(3, 5)];
  if (n === 6) return [items.slice(0, 3), items.slice(3, 6)];
  if (n === 7) return [items.slice(0, 4), items.slice(4, 7)];
  if (n === 8) return [items.slice(0, 4), items.slice(4, 8)];

  const rowCount = Math.ceil(n / 4);
  const perRow = Math.ceil(n / rowCount);
  const rows: T[][] = [];
  for (let i = 0; i < n; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

export function QuizViewer({
  slide,
  analytics,
  isPreview,
  hideResults,
  showAsPercentage,
  isRevealed: propIsRevealed,
}: Props) {
  const options = slide.options || [];
  const timeLimit = slide.responseSettings.timeToRespondSeconds || 30;

  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [internalRevealed, setInternalRevealed] = useState(false);

  const isRevealed = propIsRevealed !== undefined ? propIsRevealed : internalRevealed;

  // Countdown timer for live presentation mode (only if not a preview)
  useEffect(() => {
    if (isPreview) {
      setInternalRevealed(true);
      return;
    }

    setTimeLeft(timeLimit);
    setInternalRevealed(false);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setInternalRevealed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [slide.id, timeLimit, isPreview]);

  const getVoteCount = (optionId: string, fallback: number = 0) => {
    if (analytics?.results && Array.isArray(analytics.results)) {
      const match = analytics.results.find((r: any) => r.id === optionId);
      if (match && typeof match.count === "number") return match.count;
    }
    return fallback;
  };

  const totalVotes =
    analytics?.totalVotes ??
    options.reduce(
      (total, option) => total + getVoteCount(option.id, option.voteCount || 0),
      0
    );
  const maxVotes = Math.max(
    1,
    ...options.map((option) => getVoteCount(option.id, option.voteCount || 0))
  );
  const textColor = slide.designSettings.textColor || "#17171c";

  const isPercentage =
    showAsPercentage !== undefined
      ? showAsPercentage
      : (slide.responseSettings.showResultsAsPercentage ?? false);

  const isHidden =
    hideResults !== undefined
      ? hideResults
      : (slide.responseSettings.hideResultsFromAudience ?? false);

  const rows = splitIntoBalancedRows(options);
  const isMultiRow = rows.length > 1;

  const timerProgress = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0;

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Question Heading & Status / Countdown Bar */}
      <div className="w-full flex flex-col items-center text-center">
        <h2
          className={`font-medium leading-[1.1] tracking-[-0.04em] ${
            isPreview
              ? "text-xl sm:text-2xl max-w-xl"
              : isMultiRow
              ? "text-2xl sm:text-3xl md:text-4xl max-w-3xl"
              : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl"
          }`}
        >
          {slide.question || "Select the correct answer"}
        </h2>

        {/* Status bar & Timer */}
        <div className="flex items-center justify-center gap-3 mt-3">
          {/* Live Countdown Pill */}
          {!isPreview && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-wider transition-colors ${
                timeLeft === 0
                  ? "bg-rose-50 border-rose-300 text-rose-700"
                  : timeLeft <= 5
                  ? "bg-amber-50 border-amber-300 text-amber-700 animate-pulse"
                  : "bg-white border-neutral-300 text-neutral-800 shadow-xs"
              }`}
            >
              <Clock className="size-3.5" />
              <span>{timeLeft}s</span>
              <div className="w-12 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft <= 5 ? "bg-rose-500" : "bg-(--cf-orange)"
                  }`}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Reveal Status Chip */}
          {isRevealed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-full text-xs font-bold font-mono uppercase tracking-wider">
              <Check className="size-3 stroke-[2.5]" />
              <span>Answer revealed</span>
            </span>
          )}

          {/* Hidden Responses Badge */}
          {isHidden && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-700 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
              <EyeOff className="size-3" />
              <span>Responses hidden</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Options Grid with Correct / Incorrect Spring Reveal */}
      <div
        className={`flex flex-col items-center justify-end w-full max-w-5xl mx-auto ${
          isMultiRow ? "gap-4 sm:gap-6 pb-1" : "pb-2"
        }`}
      >
        {rows.map((rowOptions, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex items-end justify-center gap-3 sm:gap-6 md:gap-8 w-full"
          >
            {rowOptions.map((option) => {
              const globalIndex = options.findIndex((o) => o.id === option.id);
              const count = getVoteCount(option.id, option.voteCount || 0);
              const displayValue = isPercentage
                ? `${totalVotes ? Math.round((count / totalVotes) * 100) : 0}%`
                : count;
              const fill = totalVotes > 0 ? Math.max(14, (count / maxVotes) * 100) : 0;
              const isCorrect = Boolean(option.isCorrect);
              const color = option.color || colors[globalIndex % colors.length];

              return (
                <article
                  key={option.id}
                  className={`flex flex-col items-center flex-1 min-w-[90px] ${
                    isMultiRow ? "max-w-[190px]" : "max-w-[240px]"
                  }`}
                >
                  {/* Rising Bar Track */}
                  <div
                    className={`w-full flex flex-col justify-end items-center relative ${
                      isPreview
                        ? isMultiRow
                          ? "h-24 sm:h-28"
                          : "h-36 sm:h-44"
                        : isMultiRow
                        ? "h-28 sm:h-36 md:h-42"
                        : "h-56 sm:h-64 md:h-76 lg:h-84"
                    }`}
                  >
                    {/* Animated Bar Pill */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: isHidden ? "0%" : `${fill}%`,
                        opacity: isRevealed && !isCorrect ? 0.4 : 1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 75,
                        damping: 15,
                        mass: 0.85,
                        delay: isHidden ? 0 : globalIndex * 0.04,
                      }}
                      className={`w-full relative rounded-t-[16px] sm:rounded-t-[22px] transition-shadow ${
                        isRevealed && isCorrect ? "shadow-lg ring-2 ring-emerald-500" : ""
                      }`}
                      style={{
                        backgroundColor: color,
                      }}
                    >
                      {/* Attached Value Label - Sits directly above the bar */}
                      <motion.div
                        initial={false}
                        animate={{
                          opacity: isHidden || fill === 0 ? 0 : 1,
                          scale: isHidden ? 0.75 : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 85,
                          damping: 14,
                        }}
                        className="absolute bottom-full mb-1.5 left-0 right-0 flex items-center justify-center pointer-events-none"
                      >
                        <span
                          className={`font-semibold tracking-[-0.04em] text-neutral-900 text-center tabular-nums whitespace-nowrap ${
                            isPreview
                              ? "text-base sm:text-lg"
                              : isMultiRow
                              ? "text-2xl sm:text-3xl"
                              : "text-3xl sm:text-4xl md:text-5xl"
                          }`}
                        >
                          {displayValue}
                        </span>
                      </motion.div>
                    </motion.div>
                  </div>

                  {/* Option Label + Correct/Incorrect Indicator */}
                  <div className="mt-2.5 flex items-center gap-1.5 w-full justify-center">
                    {/* Status Badge (revealed or in preview) */}
                    {(isRevealed || isPreview) && (
                      <div
                        className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                          isCorrect
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-rose-100 text-rose-600 border border-rose-300"
                        }`}
                      >
                        {isCorrect ? (
                          <Check className="size-3 stroke-[3]" />
                        ) : (
                          <X className="size-3 stroke-[3]" />
                        )}
                      </div>
                    )}

                    <p
                      className={`truncate text-center font-medium ${
                        isRevealed && !isCorrect ? "text-neutral-400" : "text-neutral-800"
                      } ${
                        isPreview
                          ? "text-[11px] sm:text-xs"
                          : isMultiRow
                          ? "text-xs sm:text-sm md:text-base"
                          : "text-sm sm:text-base md:text-lg lg:text-xl"
                      }`}
                      title={option.label}
                    >
                      {option.label || `Option ${globalIndex + 1}`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
