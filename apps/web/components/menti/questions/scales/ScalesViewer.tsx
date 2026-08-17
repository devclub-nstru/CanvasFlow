"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { EyeOff, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
  hideResults?: boolean;
}

const ratingsFor = (slide: MentiSlide, min: number, max: number, analytics?: any) =>
  Array.from({ length: Math.max(2, max - min + 1) }, (_, index) => {
    const value = min + index;
    const analyticsResult = analytics?.results && Array.isArray(analytics.results)
      ? analytics.results.find((r: any) => String(r.id) === String(value) || String(r.label) === String(value) || r.id === `rate-${value}`)
      : null;

    return {
      value,
      votes: analyticsResult ? (analyticsResult.count || 0) : (
        slide.options?.find(
          (option) =>
            Number(option.label) === value || option.id === `rate-${value}`
        )?.voteCount || 0
      ),
    };
  });

export function ScalesViewer({
  slide,
  analytics,
  isPreview,
  showQuestion = true,
  hideResults,
}: Props) {
  const isHidden =
    hideResults !== undefined
      ? hideResults
      : (slide.responseSettings?.hideResultsFromAudience ?? false);

  const min =
    slide.responseSettings?.minRating !== undefined
      ? slide.responseSettings.minRating
      : 1;
  const max =
    slide.responseSettings?.maxRating !== undefined
      ? slide.responseSettings.maxRating
      : 5;
  const ratings = ratingsFor(slide, min, max, analytics);
  const total = ratings.reduce((sum, rating) => sum + rating.votes, 0);
  const average = total
    ? ratings.reduce((sum, rating) => sum + rating.value * rating.votes, 0) / total
    : min;
  const maxVotes = Math.max(1, ...ratings.map((rating) => rating.votes));
  const accent = slide.designSettings?.accentColor || "#e4a23e";
  const textColor = slide.designSettings?.textColor || "#17171c";

  const width = 1000;
  const left = 50;
  const right = width - 50;
  const baseline = 150;
  const step = (right - left) / Math.max(1, ratings.length - 1);
  const amplitude = isPreview ? 100 : 135;
  const sigma = step * 0.35;

  const samples = Array.from({ length: 121 }, (_, index) => {
    const x = left + ((right - left) * index) / 120;
    const density = ratings.reduce((sum, rating, ratingIndex) => {
      const center = left + ratingIndex * step;
      return (
        sum +
        (rating.votes / maxVotes) *
          Math.exp(-((x - center) ** 2) / (2 * sigma ** 2))
      );
    }, 0);
    return { x, y: baseline - Math.min(1, density) * amplitude };
  });

  const linePath = `M ${samples
    .map((sample) => `${sample.x.toFixed(1)} ${sample.y.toFixed(1)}`)
    .join(" L ")}`;
  const areaPath = `${linePath} L ${right} ${baseline} L ${left} ${baseline} Z`;
  const count = Math.max(2, max - min + 1);
  const normalized = Math.max(0, Math.min(1, (average - min) / Math.max(1, max - min)));
  const pinPositionPercent = ((0.5 + normalized * (count - 1)) / count) * 100;
  const trackInsetPercent = (0.5 / count) * 100;

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Question Heading & Status Area */}
      {showQuestion && (
        <div className="w-full flex flex-col items-center text-center">
          <h2
            className={`font-medium leading-[1.1] tracking-[-0.04em] ${
              isPreview
                ? "text-xl sm:text-2xl max-w-xl"
                : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl"
            }`}
          >
            {slide.question || `Rate on a scale from ${min} to ${max}`}
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
      )}

      {/* 2. Scale Distribution & Live Score Indicator */}
      <div className="w-full max-w-4xl mx-auto my-auto pt-2 pb-2">
        <div className="relative w-full">
          {/* SVG Smooth Density Curve */}
          <svg
            viewBox={`0 0 ${width} 170`}
            preserveAspectRatio="none"
            className="block h-28 sm:h-36 md:h-44 w-full overflow-visible"
            aria-label="Rating distribution curve"
          >
            <defs>
              <linearGradient
                id={`scale-gradient-${slide.id}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Density Area */}
            <motion.path
              initial={false}
              animate={{
                d: isHidden
                  ? `M ${left} ${baseline} L ${right} ${baseline} L ${right} ${baseline} L ${left} ${baseline} Z`
                  : areaPath,
                opacity: isHidden ? 0 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 70,
                damping: 15,
              }}
              fill={`url(#scale-gradient-${slide.id})`}
            />

            {/* Density Outline Path */}
            <motion.path
              initial={false}
              animate={{
                d: isHidden
                  ? `M ${left} ${baseline} L ${right} ${baseline}`
                  : linePath,
                opacity: isHidden ? 0 : 0.85,
              }}
              transition={{
                type: "spring",
                stiffness: 70,
                damping: 15,
              }}
              fill="none"
              stroke={accent}
              strokeLinecap="round"
              strokeWidth={isPreview ? "3" : "4"}
            />
          </svg>

          {/* Baseline Track Spanning Exactly From Column 1 Center to Column Max Center */}
          <div
            className="absolute bottom-0 h-2.5 rounded-full bg-(--cf-cream-2) border border-(--cf-line-strong) overflow-hidden shadow-inner"
            style={{
              left: `${trackInsetPercent}%`,
              right: `${trackInsetPercent}%`,
            }}
          >
            <motion.div
              initial={false}
              animate={{
                width: isHidden || total === 0 ? "0%" : `${normalized * 100}%`,
              }}
              transition={{
                type: "spring",
                stiffness: 75,
                damping: 15,
              }}
              className="h-full rounded-full"
              style={{ backgroundColor: accent }}
            />
          </div>

          {/* Floating Average Indicator Pin Aligned Precisely with Curve Peak & Column Center */}
          <motion.div
            initial={false}
            animate={{
              left: `${pinPositionPercent}%`,
              opacity: isHidden || total === 0 ? 0 : 1,
              scale: isHidden || total === 0 ? 0.7 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 85,
              damping: 14,
            }}
            className="absolute bottom-4 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
          >
            <div className="cf-panel cf-raised px-2.5 py-1 bg-white border-2 border-(--cf-line-strong) rounded-xl flex items-center gap-1 shadow-md">
              <Star className="size-3 sm:size-3.5" style={{ color: accent, fill: accent }} />
              <span className="text-xs sm:text-sm md:text-base font-extrabold font-mono tracking-tight text-(--cf-ink) tabular-nums">
                {average.toFixed(1)}
              </span>
            </div>
            <div className="size-1.5 bg-(--cf-line-strong) rotate-45 -mt-0.5" />
          </motion.div>
        </div>

        {/* 3. Scale Points Grid */}
        <div
          className="mt-6 sm:mt-8 grid text-center font-bold text-(--cf-ink)"
          style={{
            gridTemplateColumns: `repeat(${ratings.length}, minmax(0, 1fr))`,
          }}
        >
          {ratings.map((rating) => (
            <div key={rating.value} className="flex flex-col items-center">
              <span
                className={`font-mono ${
                  isPreview
                    ? "text-sm sm:text-base"
                    : ratings.length > 8
                    ? "text-base sm:text-lg"
                    : "text-lg sm:text-xl md:text-2xl"
                }`}
              >
                {rating.value}
              </span>
              {!isHidden && total > 0 && (
                <span className="text-[10px] sm:text-xs font-semibold text-(--cf-ink-soft) mt-0.5">
                  {rating.votes} {rating.votes === 1 ? "vote" : "votes"}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 4. Low / High Spectrum Labels */}
        <div className="mt-3 flex justify-between px-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-(--cf-ink-soft)">
          <span>{slide.responseSettings?.ratingLowLabel || "Low"}</span>
          <span>{slide.responseSettings?.ratingHighLabel || "High"}</span>
        </div>
      </div>
    </section>
  );
}

export const ScaleViewer = ScalesViewer;
