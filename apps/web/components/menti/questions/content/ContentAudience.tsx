"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { Sparkles, Heart } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit?: (val: any) => void;
  hasSubmitted?: boolean;
}

export function ContentAudience({ slide }: Props) {
  const title = slide.question || "Thank you!";
  const description =
    slide.description !== undefined && slide.description !== null
      ? slide.description
      : "We appreciate your time and participation.";

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
      {/* Icon Badge */}
      <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center">
        <Heart className="w-7 h-7 text-(--cf-orange) fill-(--cf-orange)" />
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-bold leading-snug tracking-[-0.03em] text-(--cf-ink) max-w-xs">
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p className="text-sm text-(--cf-ink-soft) max-w-xs leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
