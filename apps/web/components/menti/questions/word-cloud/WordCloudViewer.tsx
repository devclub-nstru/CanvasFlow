"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { motion } from "motion/react";
import { Cloud } from "lucide-react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
}

const CLOUD_COLORS = [
  "#2d5cf6",
  "#e11d48",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#3b82f6",
];

export function WordCloudViewer({ slide, isPreview }: Props) {
  const words = slide.options || [];
  const maxCount = Math.max(...words.map((w) => w.voteCount || 1), 1);
  const minCount = Math.min(...words.map((w) => w.voteCount || 1), 1);

  const getFontSize = (count: number) => {
    if (maxCount === minCount) return isPreview ? "1.1rem" : "1.75rem";
    const minSize = isPreview ? 0.85 : 1.25;
    const maxSize = isPreview ? 2.0 : 3.5;
    const normalized = (count - minCount) / (maxCount - minCount);
    const size = minSize + normalized * (maxSize - minSize);
    return `${size.toFixed(2)}rem`;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl px-6 mx-auto">
      <h2
        className={`font-semibold text-center leading-tight mb-8 ${
          isPreview ? "text-2xl" : "text-4xl md:text-5xl"
        }`}
        style={{ color: slide.designSettings.textColor || "#1a1d29" }}
      >
        {slide.question || "Enter your word cloud question..."}
      </h2>

      {words.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-neutral-300 text-neutral-400">
          <Cloud className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm font-medium">Waiting for word cloud entries...</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center w-full gap-4 p-6 md:gap-8">
          {words.map((word, idx) => {
            const count = word.voteCount || 1;
            const color = CLOUD_COLORS[idx % CLOUD_COLORS.length];

            return (
              <motion.span
                key={word.id || idx}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 14, delay: idx * 0.03 }}
                style={{
                  fontSize: getFontSize(count),
                  color,
                }}
                className="font-bold tracking-tight cursor-default select-none hover:scale-110 transition-transform"
                title={`${word.label}: ${count} votes`}
              >
                {word.label}
              </motion.span>
            );
          })}
        </div>
      )}
    </div>
  );
}
