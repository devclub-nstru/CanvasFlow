"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { motion } from "motion/react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
}

export function BarGraphViewer({ slide, isPreview }: Props) {
  const options = slide.options || [];
  const totalVotes = options.reduce((acc, curr) => acc + (curr.voteCount || 0), 0);
  const showPercentage = slide.responseSettings.showResultsAsPercentage;
  const maxVotes = Math.max(...options.map((o) => o.voteCount || 0), 1);

  return (
    <div className="flex flex-col items-center justify-between w-full h-full max-w-5xl px-6 py-8 mx-auto">
      <h2
        className={`font-semibold text-center leading-tight mb-8 ${
          isPreview ? "text-2xl" : "text-4xl md:text-5xl"
        }`}
        style={{ color: slide.designSettings.textColor || "#1a1d29" }}
      >
        {slide.question || "Enter your question..."}
      </h2>

      {/* Bar Chart Area */}
      <div className="flex items-end justify-center w-full h-64 gap-6 px-4 md:h-80">
        {options.map((option, idx) => {
          const count = option.voteCount || 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const heightPercent = totalVotes > 0 ? (count / maxVotes) * 100 : 0;

          return (
            <div
              key={option.id || idx}
              className="flex flex-col items-center flex-1 h-full justify-end max-w-[140px]"
            >
              {/* Vote Count / Percentage Label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 text-base font-bold text-neutral-800"
              >
                {showPercentage ? `${percent}%` : count}
              </motion.div>

              {/* Animated Bar */}
              <div className="flex items-end w-full h-full overflow-hidden bg-neutral-100 rounded-t-xl">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPercent, 4)}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 15 }}
                  className="w-full rounded-t-xl"
                  style={{
                    backgroundColor:
                      option.color ||
                      (idx === 0
                        ? "#2d5cf6"
                        : idx === 1
                          ? "#e11d48"
                          : idx === 2
                            ? "#10b981"
                            : "#8b5cf6"),
                  }}
                />
              </div>

              {/* Option Title Label */}
              <div className="w-full mt-3 text-center">
                <p
                  className="text-xs font-semibold truncate text-neutral-800 md:text-sm"
                  title={option.label}
                >
                  {option.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
