"use client";

import React from "react";

interface FormHeaderProps {
  progressPercent: number;
  submitted: boolean;
  formCode: string;
  formTitle?: string;
}

export function FormHeader({ progressPercent, submitted }: FormHeaderProps) {
  const pct = submitted ? 100 : progressPercent;

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Form progress"
      className="fixed top-0 left-0 right-0 z-50 h-2 w-full bg-(--cf-line) shadow-[0_2px_6px_rgba(26,29,41,0.08)]"
    >
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: "var(--cf-orange)",
          boxShadow: "0 0 8px rgba(246, 111, 0, 0.65)",
        }}
      />
    </div>
  );
}
