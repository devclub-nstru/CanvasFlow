"use client";

import React from "react";

interface DevclubIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export function DevclubIcon({ className = "size-6", size, ...props }: DevclubIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Devclub Logo"
      role="img"
      {...props}
    >
      {/* 1. Top-Left Quadrant */}
      <path d="M 8 28 A 18 18 0 0 1 26 10 L 44 10 L 44 26 C 44 37 36 45 25 45 L 8 45 Z" />

      {/* 2. Bottom-Left Quadrant */}
      <path d="M 8 55 L 25 55 C 36 55 44 63 44 74 L 44 90 L 26 90 A 18 18 0 0 1 8 72 Z" />

      {/* 3. Right 'D' Loop with Center Sparkle Cutout */}
      <path d="M 50 10 L 64 10 C 85 10 96 28 96 50 C 96 72 85 90 64 90 L 50 90 L 50 74 C 50 63 58 55 69 50 C 58 45 50 37 50 26 Z" />
    </svg>
  );
}

interface DevclubLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "auto";
}

export function DevclubLogo({
  className = "",
  iconClassName = "",
  textClassName = "",
  showText = true,
  size = "md",
}: DevclubLogoProps) {
  const sizeMap = {
    sm: { icon: "size-4", text: "text-xs", gap: "gap-1.5" },
    md: { icon: "size-5 sm:size-6", text: "text-sm sm:text-base", gap: "gap-2" },
    lg: { icon: "size-7 sm:size-8", text: "text-lg sm:text-xl", gap: "gap-2.5" },
    xl: { icon: "size-9 sm:size-10", text: "text-2xl sm:text-3xl", gap: "gap-3" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center ${currentSize.gap} font-sans select-none ${className}`}>
      <DevclubIcon className={`${currentSize.icon} shrink-0 ${iconClassName}`} />
      {showText && (
        <span
          className={`font-black tracking-[-0.04em] leading-none ${currentSize.text} ${textClassName}`}
        >
          Devclub<span className="text-(--cf-orange)">.</span>
        </span>
      )}
    </div>
  );
}

export function DevclubWatermark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-xs border-2 border-(--cf-line-strong) cf-raised rounded-full shadow-sm text-(--cf-ink) hover:border-(--cf-orange) transition-colors ${className}`}
      title="Powered by Devclub"
    >
      <DevclubIcon className="size-4 text-(--cf-ink)" />
      <span className="text-xs font-bold tracking-tight text-(--cf-ink) font-sans">
        Devclub<span className="text-(--cf-orange) font-black">.</span>
      </span>
    </div>
  );
}
