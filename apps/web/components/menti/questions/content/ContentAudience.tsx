"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { Sparkles, Star, Lightbulb, Heart, Info, Quote } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit?: (val: any) => void;
  hasSubmitted?: boolean;
}

const ICON_MAP = {
  sparkles: Sparkles,
  star: Star,
  lightbulb: Lightbulb,
  heart: Heart,
  info: Info,
  quote: Quote,
};

export function ContentAudience({ slide }: Props) {
  const contentImageUrl = slide.designSettings?.contentImageUrl;
  const title = slide.question || "";
  const description = slide.description || "";
  const eyebrow = slide.designSettings?.eyebrow;
  const textAlign = slide.designSettings?.textAlign || "center";
  const iconKey = slide.designSettings?.icon;
  const accentColor = slide.designSettings?.accentColor || "#e4a23e";

  if (contentImageUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-4 w-full select-none">
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-(--cf-line-strong) bg-neutral-900/5 shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contentImageUrl}
            alt={title || "PowerPoint Slide"}
            className="w-full h-full object-fill"
            loading="eager"
          />
        </div>
        {title && title !== `Slide ${slide.position + 1}` && (
          <p className="mt-3 text-xs sm:text-sm font-bold text-(--cf-ink) text-center">{title}</p>
        )}
      </div>
    );
  }

  const IconComponent = iconKey && iconKey !== "none" ? ICON_MAP[iconKey as keyof typeof ICON_MAP] : null;

  const alignClasses =
    textAlign === "left"
      ? "items-start text-left"
      : textAlign === "right"
      ? "items-end text-right"
      : "items-center text-center";

  return (
    <div className={`flex flex-col justify-center py-6 sm:py-8 space-y-3 sm:space-y-4 w-full ${alignClasses}`}>
      {/* Optional Icon Badge */}
      {IconComponent && (
        <div
          className="size-12 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-1"
          style={{ color: accentColor }}
        >
          <IconComponent className="w-6 h-6" />
        </div>
      )}

      {/* Optional Eyebrow */}
      {eyebrow && (
        <span
          className="cf-eyebrow text-xs font-bold tracking-wider uppercase"
          style={{ color: accentColor }}
        >
          {eyebrow}
        </span>
      )}

      {/* Heading */}
      {title && (
        <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {title}
        </h2>
      )}

      {/* Description */}
      {description && (
        <div className="text-xs sm:text-sm text-(--cf-ink-soft) leading-relaxed whitespace-pre-line">
          {description}
        </div>
      )}
    </div>
  );
}
