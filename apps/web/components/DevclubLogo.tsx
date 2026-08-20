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
      {/* 1. Top-Left Quadrant (Flat left wall, rounded top-left corner, concave sparkle cutout) */}
      <path d="M 12 47 L 12 32 A 20 20 0 0 1 32 12 L 47 12 L 47 24 A 23 23 0 0 0 24 47 Z" />

      {/* 2. Bottom-Left Quadrant (Flat left wall, rounded bottom-left corner, concave sparkle cutout) */}
      <path d="M 12 53 L 24 53 A 23 23 0 0 0 47 76 L 47 88 L 32 88 A 20 20 0 0 1 12 68 Z" />

      {/* 3. Right 'D' Arch (Smooth outer D loop with center sparkle notch) */}
      <path d="M 53 12 L 62 12 C 80 12 90 28 90 50 C 90 72 80 88 62 88 L 53 88 L 53 76 A 26 26 0 0 0 76 50 A 26 26 0 0 0 53 24 Z" />
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
