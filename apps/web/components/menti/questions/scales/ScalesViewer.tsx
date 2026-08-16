"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { motion } from "motion/react";
import { Star } from "lucide-react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
  hideResults?: boolean;
}

export function ScalesViewer({ slide, isPreview, hideResults = false }: Props) {
  const options = slide.options || [];
  const totalVotes = options.reduce((acc, curr) => acc + (curr.voteCount || 0), 0);

  const weightedSum = options.reduce((acc, curr) => {
    const score = Number(curr.label) || 1;
    return acc + score * (curr.voteCount || 0);
  }, 0);

  const averageScore = totalVotes > 0 ? (weightedSum / totalVotes).toFixed(1) : "0.0";
  const lowLabel = slide.responseSettings.ratingLowLabel || "Low";
  const highLabel = slide.responseSettings.ratingHighLabel || "High";

  return (
    <div className="flex flex-col items-center justify-between w-full h-full max-w-4xl px-6 py-8 mx-auto">
      <h2
        className={`font-semibold text-center leading-tight mb-6 ${
          isPreview ? "text-2xl" : "text-4xl md:text-5xl"
        }`}
        style={{ color: slide.designSettings.textColor || "#1a1d29" }}
      >
        {slide.question || "Enter your scales question..."}
      </h2>

      {/* Big Average Score Display */}
      <div className="flex flex-col items-center justify-center my-4">
        <div className="flex items-center gap-3">
          <Star className="w-10 h-10 text-amber-500 fill-amber-500" />
          <span className="text-6xl font-black tracking-tight text-neutral-900 md:text-7xl">
            {hideResults ? "—" : averageScore}
          </span>
          <span className="text-xl font-bold text-neutral-400">/ 5.0</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          {hideResults ? "Results hidden by presenter" : `${totalVotes} responses`}
        </p>
      </div>

      {/* Distribution Spectrum */}
      <div className="w-full max-w-xl space-y-2">
        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-neutral-400">
          <span>1 • {lowLabel}</span>
          <span>5 • {highLabel}</span>
        </div>

        <div className="flex items-end h-24 gap-3">
          {options.map((opt, idx) => {
            const count = opt.voteCount || 0;
            const heightPercent = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

            return (
              <div key={opt.id || idx} className="flex flex-col items-center flex-1 h-full justify-end">
                <span className="text-xs font-bold text-neutral-600 mb-1">{count}</span>
                <div className="w-full h-full bg-neutral-100 rounded-t-md flex items-end overflow-hidden">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPercent, 4)}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    className="w-full bg-amber-500 rounded-t-md"
                  />
                </div>
                <span className="mt-1 text-xs font-bold text-neutral-700">{opt.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
