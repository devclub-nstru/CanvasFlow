"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  hideResults?: boolean;
  showAsPercentage?: boolean;
}

const colors = ["#5268e8", "#ff7378", "#313c8e", "#9189eb", "#43b7a6", "#e4a23e"];

/** Split option list into balanced rows (e.g. 4 -> 1x4, 5 -> 3+2, 6 -> 3+3, 7 -> 4+3, 8 -> 4+4) */
function splitIntoBalancedRows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n <= 4) return [items];
  if (n === 5) return [items.slice(0, 3), items.slice(3, 5)];
  if (n === 6) return [items.slice(0, 3), items.slice(3, 6)];
  if (n === 7) return [items.slice(0, 4), items.slice(4, 7)];
  if (n === 8) return [items.slice(0, 4), items.slice(4, 8)];
  if (n === 9) return [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)];
  if (n === 10) return [items.slice(0, 4), items.slice(4, 7), items.slice(7, 10)];

  const rowCount = Math.ceil(n / 4);
  const perRow = Math.ceil(n / rowCount);
  const rows: T[][] = [];
  for (let i = 0; i < n; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

export function BarGraphViewer({
  slide,
  analytics,
  isPreview,
  hideResults,
  showAsPercentage,
}: Props) {
  const options = slide.options;

  const getVoteCount = (optionId: string, fallback: number = 0) => {
    if (analytics?.results && Array.isArray(analytics.results)) {
      const match = analytics.results.find((r: any) => r.id === optionId);
      if (match && typeof match.count === "number") return match.count;
    }
    return fallback;
  };

  const totalVotes = analytics?.totalVotes ?? options.reduce((total, option) => total + getVoteCount(option.id, option.voteCount || 0), 0);
  const maxVotes = Math.max(1, ...options.map((option) => getVoteCount(option.id, option.voteCount || 0)));
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

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Question Heading & Status Area */}
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
          {slide.question || "Which of these..."}
        </h2>

        {/* Fixed height reservation for status badge */}
        <div className="h-6 flex items-center justify-center mt-1">
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

      {/* 2. Balanced Multi-Row Grid of Centered Columns */}
      <div className={`flex flex-col items-center justify-end w-full max-w-5xl mx-auto ${isMultiRow ? "gap-4 sm:gap-6 pb-1" : "pb-2"}`}>
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
              const color = option.color || colors[globalIndex % colors.length];

              return (
                <article
                  key={option.id}
                  className={`flex flex-col items-center flex-1 min-w-[90px] ${
                    isMultiRow ? "max-w-[190px]" : "max-w-[240px]"
                  }`}
                >
                  {/* Borderless Track Container */}
                  <div
                    className={`w-full flex flex-col justify-end items-center relative ${
                      isPreview
                        ? isMultiRow ? "h-24 sm:h-28" : "h-36 sm:h-44"
                        : isMultiRow
                        ? "h-28 sm:h-36 md:h-42"
                        : "h-56 sm:h-64 md:h-76 lg:h-84"
                    }`}
                  >
                    {/* Dynamic Rising Bar Pill with Floating Attached Value */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: isHidden ? "0%" : `${fill}%`,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 75,
                        damping: 15,
                        mass: 0.85,
                        delay: isHidden ? 0 : globalIndex * 0.04,
                      }}
                      className="w-full relative rounded-t-[16px] sm:rounded-t-[22px]"
                      style={{ backgroundColor: color }}
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

                  {/* Option Label below baseline */}
                  <p
                    className={`mt-2 truncate w-full text-center font-medium text-neutral-700 ${
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
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
