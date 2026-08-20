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
      {/* Exact Devclub 'D' with 4-point star negative space and left horizontal slit */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 10 46 L 10 26 A 16 16 0 0 1 26 10 L 54 10 C 76 10 90 26 90 50 C 90 74 76 90 54 90 L 26 90 A 16 16 0 0 1 10 74 L 10 54 L 30 54 C 38 54 44 60 44 70 C 44 60 50 50 66 50 C 50 50 44 40 44 30 C 44 40 38 46 30 46 L 10 46 Z"
      />
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
