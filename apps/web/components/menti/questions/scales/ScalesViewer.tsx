"use client";

import { MentiSlide } from "~/lib/menti";
import { EyeOff } from "lucide-react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
  showQuestion?: boolean;
  hideResults?: boolean;
}

const ratingsFor = (slide: MentiSlide, min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    return {
      value,
      votes: slide.options.find((option) => Number(option.label) === value)?.voteCount || 0,
    };
  });

export function ScalesViewer({
  slide,
  isPreview,
  showQuestion = true,
  hideResults = false,
}: Props) {
  const min = slide.responseSettings.minRating || 1;
  const max = slide.responseSettings.maxRating || 5;
  const ratings = ratingsFor(slide, min, max);
  const total = ratings.reduce((sum, rating) => sum + rating.votes, 0);
  const average = total
    ? ratings.reduce((sum, rating) => sum + rating.value * rating.votes, 0) / total
    : min;
  const maxVotes = Math.max(1, ...ratings.map((rating) => rating.votes));
  const accent = slide.designSettings.accentColor || "#5268e8";
  const width = 1000;
  const left = 36;
  const right = width - 36;
  const baseline = 156;
  const step = (right - left) / Math.max(1, ratings.length - 1);
  const amplitude = isPreview ? 120 : 175;
  const sigma = step * 0.32;
  const samples = Array.from({ length: 121 }, (_, index) => {
    const x = left + ((right - left) * index) / 120;
    const density = ratings.reduce((sum, rating, ratingIndex) => {
      const center = left + ratingIndex * step;
      return sum + (rating.votes / maxVotes) * Math.exp(-((x - center) ** 2) / (2 * sigma ** 2));
    }, 0);
    return { x, y: baseline - Math.min(1, density) * amplitude };
  });
  const linePath = `M ${samples
    .map((sample) => `${sample.x.toFixed(1)} ${sample.y.toFixed(1)}`)
    .join(" L ")}`;
  const areaPath = `${linePath} L ${right} ${baseline} L ${left} ${baseline} Z`;
  const progress = ((average - min) / Math.max(1, max - min)) * 100;

  return (
    <section
      className={`flex h-full w-full flex-col ${isPreview ? "px-5 py-4" : "px-[4%] py-[3.2%]"}`}
      style={{ color: slide.designSettings.textColor || "#17171c" }}
    >
      {showQuestion && (
        <h2
          className={`font-medium leading-[1.08] tracking-[-0.05em] ${
            isPreview ? "text-2xl" : "text-5xl md:text-7xl"
          }`}
        >
          {slide.question || "Statement 1"}
        </h2>
      )}
      <div className="mt-auto w-full">
        {hideResults ? (
          <div className="flex flex-col items-center justify-center py-10 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
            <EyeOff className="w-8 h-8 text-neutral-400 mb-2" />
            <p className="text-sm font-semibold text-neutral-500">Results hidden by presenter</p>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} 190`}
              preserveAspectRatio="none"
              className="block h-28 w-full overflow-visible md:h-44"
              aria-label="Rating distribution"
            >
              <defs>
                <linearGradient id={`scale-gradient-${slide.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <path
                d={areaPath}
                fill={`url(#scale-gradient-${slide.id})`}
                className="transition-[d] duration-700 ease-out"
              />
              <path
                d={linePath}
                fill="none"
                stroke={accent}
                strokeLinecap="round"
                strokeWidth="3"
                opacity="0.65"
                className="transition-[d] duration-700 ease-out"
              />
            </svg>
            <div className="absolute left-0 right-0 top-[74%] h-2 rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%`, backgroundColor: accent }}
              />
            </div>
            <div
              className="absolute top-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-lg font-semibold text-white shadow-lg transition-all duration-700 ease-out md:px-4 md:py-3 md:text-3xl"
              style={{ left: `${progress}%`, backgroundColor: accent }}
            >
              {total ? average.toFixed(1) : min.toFixed(1)}
            </div>
          </div>
        )}
        <div
          className="mt-7 grid text-center font-medium text-neutral-700"
          style={{ gridTemplateColumns: `repeat(${ratings.length}, minmax(0, 1fr))` }}
        >
          {ratings.map((rating) => (
            <span key={rating.value} className={isPreview ? "text-base" : "text-2xl md:text-3xl"}>
              {rating.value}
            </span>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-neutral-400 md:text-base">
          <span>{slide.responseSettings.ratingLowLabel || "Low"}</span>
          <span>{slide.responseSettings.ratingHighLabel || "High"}</span>
        </div>
      </div>
    </section>
  );
}

export const ScaleViewer = ScalesViewer;
