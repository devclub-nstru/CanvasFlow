"use client";

import React, { useState, useEffect } from "react";
import { MentiSlide } from "~/lib/menti";
import { Check, Clock, EyeOff, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  hideResults?: boolean;
  showAsPercentage?: boolean;
  isRevealed?: boolean;
  onRevealAnswer?: () => void;
  quizState?: {
    slideId?: string | null;
    startedAt?: string | null;
    endsAt?: string | null;
    durationMs?: number | null;
    isLocked?: boolean;
  } | null;
}

const colors = ["#5268e8", "#ff7378", "#313c8e", "#9189eb", "#43b7a6", "#e4a23e"];

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
  quizState,
}: Props) {
  const options = slide.options || [];
  const timeLimit = slide.quizSettings?.timeLimitSeconds || slide.responseSettings?.timeToRespondSeconds || 30;

  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [internalRevealed, setInternalRevealed] = useState(false);

  const isRevealed =
    propIsRevealed === true ||
    timeLeft === 0 ||
    quizState?.isLocked === true ||
    internalRevealed;

  // Synchronized countdown timer
  useEffect(() => {
    if (isPreview) {
      setInternalRevealed(true);
      return;
    }

    const mountTime = Date.now();
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

    if (quizState?.isLocked || (quizState?.endsAt && initial === 0)) {
      setInternalRevealed(true);
      return;
    }

    setInternalRevealed(false);

    const timer = setInterval(() => {
      const remaining = computeTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setInternalRevealed(true);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [slide.id, timeLimit, isPreview, quizState?.endsAt, quizState?.isLocked]);

  const getVoteCount = (optionId: string, fallback: number = 0) => {
    if (analytics?.results && Array.isArray(analytics.results)) {
      const match = analytics.results.find((r: any) => String(r.id) === String(optionId));
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

  const textColor = slide.designSettings?.textColor || "#17171c";

  const isPercentage =
    showAsPercentage !== undefined
      ? showAsPercentage
      : (slide.responseSettings?.showResultsAsPercentage ?? false);

  const isHidden =
    hideResults !== undefined
      ? hideResults
      : (slide.responseSettings?.hideResultsFromAudience ?? false);

  const rows = splitIntoBalancedRows(options);
  const isMultiRow = rows.length > 1;

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Question Heading & Status / Countdown */}
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

        {/* Fixed height reservation for status badge & countdown */}
        <div className="h-6 flex items-center justify-center gap-2 mt-1">
          {/* Live Monospace Countdown Badge */}
          {!isPreview && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-(--hex-radius) border text-[10px] font-mono font-bold tracking-wider uppercase ${
                timeLeft <= 5 && timeLeft > 0
                  ? "bg-rose-50 border-rose-400 text-rose-700 animate-pulse"
                  : "bg-(--cf-cream-2) border-(--cf-line-strong) text-(--cf-ink)"
              }`}
            >
              <Clock className="w-3 h-3 text-(--cf-orange)" />
              <span className="tabular-nums">{timeLeft}s</span>
            </div>
          )}

          {/* Responses Hidden Badge */}
          <AnimatePresence>
            {isHidden && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-(--cf-cream-2) border border-(--cf-line-strong) rounded-(--hex-radius) text-[10px] font-mono font-bold tracking-wider uppercase text-(--cf-ink)"
              >
                <EyeOff className="w-3 h-3 text-(--cf-ink-soft)" />
                <span>Responses hidden</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. Options Grid with Clean Spring Animation */}
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
              const fill = totalVotes > 0 ? Math.max(12, (count / maxVotes) * 100) : 0;
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
                    {/* Dynamic Bar */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: isHidden ? "0%" : `${fill}%`,
                        opacity: isRevealed && !isCorrect ? 0.25 : 1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 75,
                        damping: 15,
                        mass: 0.85,
                        delay: isHidden ? 0 : globalIndex * 0.04,
                      }}
                      className={`w-full relative rounded-t-[16px] sm:rounded-t-[22px] ${
                        isRevealed && isCorrect
                          ? "ring-4 ring-emerald-500/50 shadow-lg border-2 border-emerald-500"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {/* Floating Score Label */}
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

                  {/* Option Label + Correct/Incorrect Badge below baseline */}
                  <div className="mt-2 flex flex-col items-center justify-center gap-1 w-full">
                    {isRevealed && (
                      <div className="animate-in fade-in zoom-in-90 duration-300">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-sm">
                            <Check className="size-3 stroke-[3]" />
                            <span>Correct</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-semibold">
                            <X className="size-2.5 stroke-[2.5]" />
                            <span>Incorrect</span>
                          </span>
                        )}
                      </div>
                    )}

                    <p
                      className={`truncate w-full text-center font-medium transition-colors ${
                        isRevealed
                          ? isCorrect
                            ? "text-emerald-950 font-bold"
                            : "text-neutral-400 font-normal"
                          : "text-neutral-700"
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
