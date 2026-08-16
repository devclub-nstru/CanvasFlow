"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { Sparkles, Heart } from "lucide-react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
}

export function ContentViewer({ slide, isPreview }: Props) {
  const title = slide.question || "Thank you!";
  const description =
    slide.description !== undefined && slide.description !== null
      ? slide.description
      : "We appreciate your time and participation.";
  const textColor = slide.designSettings?.textColor || "#17171c";

  return (
    <section
      className="flex flex-col justify-center items-center h-full w-full max-w-4xl mx-auto px-6 py-6 sm:py-8 select-none text-center relative"
      style={{ color: textColor }}
    >
      <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 my-auto">
        {/* Main Display Heading */}
        <h1
          className={`cf-display font-black text-(--cf-ink) tracking-tight leading-[1.1] max-w-3xl ${
            isPreview ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
          }`}
        >
          {title}
        </h1>

        {/* Subtitle / Description */}
        {description && (
          <p
            className={`font-medium text-(--cf-ink-soft) max-w-2xl leading-relaxed ${
              isPreview ? "text-sm sm:text-base" : "text-base sm:text-lg md:text-xl lg:text-2xl"
            }`}
          >
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
