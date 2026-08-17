"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { Sparkles, Star, Lightbulb, Heart, Info, Quote } from "lucide-react";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
}

const ICON_MAP = {
  sparkles: Sparkles,
  star: Star,
  lightbulb: Lightbulb,
  heart: Heart,
  info: Info,
  quote: Quote,
};

export function ContentViewer({ slide, isPreview }: Props) {
  const title = slide.question || "";
  const description = slide.description || "";
  const eyebrow = slide.designSettings?.eyebrow;
  const textAlign = slide.designSettings?.textAlign || "center";
  const iconKey = slide.designSettings?.icon;
  const accentColor = slide.designSettings?.accentColor || "#e4a23e";
  const textColor = slide.designSettings?.textColor || "#17171c";

  const IconComponent = iconKey && iconKey !== "none" ? ICON_MAP[iconKey as keyof typeof ICON_MAP] : null;

  const alignClasses =
    textAlign === "left"
      ? "items-start text-left"
      : textAlign === "right"
      ? "items-end text-right"
      : "items-center text-center";

  const titleLength = title.length;

  return (
    <section
      className={`flex flex-col justify-center h-full w-full max-w-4xl mx-auto px-6 py-6 sm:py-8 select-none relative ${alignClasses}`}
      style={{ color: textColor }}
    >
      <div className={`flex flex-col space-y-3 sm:space-y-5 my-auto max-w-3xl w-full ${alignClasses}`}>
        {/* Optional Icon Badge */}
        {IconComponent && (
          <div
            className="size-12 sm:size-14 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-1 transition-transform animate-in zoom-in-95 duration-200"
            style={{ color: accentColor }}
          >
            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        )}

        {/* Optional Eyebrow / Kicker Tag */}
        {eyebrow && (
          <span
            className="cf-eyebrow text-xs sm:text-sm font-bold tracking-widest uppercase"
            style={{ color: accentColor }}
          >
            {eyebrow}
          </span>
        )}

        {/* Main Display Heading */}
        {title && (
          <h1
            className={`cf-display font-black tracking-tight leading-[1.1] text-(--cf-ink) ${
              isPreview
                ? titleLength > 40
                  ? "text-2xl sm:text-3xl"
                  : "text-3xl sm:text-4xl"
                : titleLength > 60
                ? "text-3xl sm:text-4xl md:text-5xl"
                : titleLength > 30
                ? "text-4xl sm:text-5xl md:text-6xl"
                : "text-5xl sm:text-6xl md:text-7xl"
            }`}
          >
            {title}
          </h1>
        )}

        {/* Subtitle / Body Description */}
        {description && (
          <div
            className={`font-medium text-(--cf-ink-soft) leading-relaxed whitespace-pre-line ${
              isPreview
                ? "text-xs sm:text-sm"
                : "text-base sm:text-lg md:text-xl lg:text-2xl"
            }`}
          >
            {description}
          </div>
        )}
      </div>
    </section>
  );
}
